import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatSliderChange } from '@angular/material/slider';
import * as d3 from "d3";
import {MatPaginator} from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

interface Team {
  id: number;
  minimumDiversity: number;
  maxGender: number;
  hiredWomen: number;
  hiredMen: number;
  attainedDiversity: number;
  attainedProductivity: number;
  hired: Array<People>;
  compDifference: number;
}

interface People {
  male: boolean;
  competency: number;
  hiredTeam?: Team;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit{

  /**The app works like a simulation
   * 1. User clicks play
   * 2. Students get hired by teams
   * 3. Teams' scores are calculated, displayed in a table
   * 4. Attributes of teams can be plotted against each other to display the relationships between attributes
  */

  // Display
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<Team>;
  averageProductivity: number;
  
  // Simulation parameters
  percentMale: number = 0.8;
  averageCompetency: number = 0;
  competencyDev: number = 1000;
  minDiversity: number = 0;
  maxDiversity: number = 1;
  numPeople: number = 5000;
  numTeam: number = 50;
  hires: number = 50;

  // Simulation objects
  teams: Array<Team> = [];
  people: Array<People> = [];
  notHired: Array<People> = [];
  peopleCompetencyGenerator: any = d3.randomNormal(this.averageCompetency, this.competencyDev);

  // Table
  displayedColumns: string[] = [
    'position',
    'minimumDiversity',
    'attainedDiversity',
    'attainedProductivity',
    'compDifference'
  ];

  constructor(){
  }

  ngAfterViewInit(){
  }

  updateNumPeople(event: MatSliderChange): void {
    this.numPeople = event.value ? event.value : 0;
  }

  updateCompetency(mean: number, dev: number): void {
    this.peopleCompetencyGenerator = d3.randomNormal(this.averageCompetency, this.competencyDev);
  }

  round(x: number): number {
    return Math.round(x*1000) / 1000;
  }

  generateTeams(): void {
    this.teams = [];
    for (let index = 0; index < this.numTeam; index++) {

      let minimumDiversity = this.round(this.minDiversity + Math.random() * (this.maxDiversity - this.minDiversity));

      /**
       * Ratio of men to women or women to men
       * The smaller the diversity score is, the larger the gender gap ratio
       */
      let ratio = 2 / (minimumDiversity + 0.0000001) - 1;
      
      // maximum number of men or women to hire
      let maxGender = Math.round((this.hires * ratio) / (1 + ratio));
      
      this.teams.push({
        id: index + 1,
        minimumDiversity: minimumDiversity,
        maxGender: maxGender,
        hiredMen: 0,
        hiredWomen: 0,
        hired: [],
        attainedDiversity: 0,
        attainedProductivity: 0,
        compDifference: 0
      })
    }
  }

  // Generate random people
  generatePeople(): void {
    this.people = [];
    for (let index = 0; index < this.numPeople; index++) {
      this.people.push({
        competency: this.peopleCompetencyGenerator(),
        male: Math.random() < this.percentMale
      })
    }
    this.people = this.people.sort((a, b) => a.competency - b.competency);
  }

  /**
   * Teams hire people. A random ordering of hiring events is generated.
   * At each hiring event, a team recruits someone from the candidate
   * population. Each team always hires the most competent candidate that
   * is available while ensuring they are meeting their diversity quota.
  */
  startHiring(): void {
    this.generateTeams();
    this.generatePeople();

    this.notHired = this.people;
    let hiringSequence: Team[] = [];

    // Generate a random sequence 
    for (let index = 0; index < this.hires; index++) {
      hiringSequence = hiringSequence.concat(this.teams);
    }
    this._shuffleArray(hiringSequence);

    hiringSequence.forEach(team => {

      // currentIndex
      let index = 1;

      // Search for candidates
      while (this.notHired.length - index >= 0) {
        let person = this.notHired[this.notHired.length - index];
        if (team.hiredMen !== team.maxGender && person.male === true){
          person.hiredTeam = team;
          team.hiredMen += 1;
          team.hired.push(person);
          this.notHired.splice(this.notHired.length - index, 1);
          break;
        } else if (team.hiredWomen !== team.maxGender && person.male === false){
          person.hiredTeam = team;
          team.hiredWomen += 1;
          team.hired.push(person);
          this.notHired.splice(this.notHired.length - index, 1);
          break;
        } else {
          index += 1;
        }
      }
    });

    let totalProductivity = 0;

    this.teams.forEach(team => {

      // Calculate team's productivity by averaging hired people's competency
      let totalCompetency = 0;
      let womenCompetency = 0;
      let menCompetency = 0;
      team.hired.forEach(person => {
        totalCompetency += person.competency;
        if (person.male === true){
          menCompetency += person.competency;
        } else {
          womenCompetency += person.competency;
        }
      });

      // Calculate team's productivity score
      team.compDifference = this.round(Math.abs(this.round(menCompetency / team.hiredMen) - this.round(womenCompetency / team.hiredWomen)));
      team.attainedProductivity = this.round(totalCompetency / team.hired.length);
      totalProductivity += team.attainedProductivity;

      // Calculate team's final diversity score
      let actualRatio = team.hiredWomen > team.hiredMen ? team.hiredWomen / team.hiredMen : team.hiredMen / team.hiredWomen;
      team.attainedDiversity = this.round(2 / (actualRatio + 1));
    });

    this.averageProductivity = this.round(totalProductivity / this.teams.length);
    this.dataSource = new MatTableDataSource(this.teams);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }
}
