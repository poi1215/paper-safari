/**
 * Paper Safari Game Engine Types
 */

export enum AnimalType {
  LION = 'lion',
  ZEBRA = 'zebra',
  GIRAFFE = 'giraffe',
  ELEPHANT = 'elephant'
}

export enum TerrainType {
  SAVANNA = 'savanna',
  WATER = 'water',
  TREE = 'tree',
  DESERT = 'desert',
  HILL = 'hill'
}

export enum ActionType {
  MOVE = 'move',
  ABILITY = 'ability',
  PASS = 'pass'
}

export interface Position {
  x: number;
  y: number;
}

export interface Animal {
  id: string;
  type: AnimalType;
  playerId: string;
  position: Position;
  health: number;
  abilities: string[];
}

export interface Tile {
  position: Position;
  terrain: TerrainType;
  animal?: Animal;
}

export interface GameBoard {
  width: number;
  height: number;
  tiles: Tile[][];
}

export interface Player {
  id: string;
  name: string;
  color: string;
  animals: Animal[];
  score: number;
  isAI: boolean;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  currentPlayerIndex: number;
  players: Player[];
  board: GameBoard;
  history: GameAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GameAction {
  playerId: string;
  timestamp: Date;
  actionType: ActionType;
  animalId?: string;
  targetPosition?: Position;
  result: {
    success: boolean;
    scoreChange: number;
    message: string;
  };
}

export interface GameConfig {
  maxRounds: number;
  boardWidth: number;
  boardHeight: number;
  initialAnimalsPerPlayer: number;
  turnTimeLimit: number; // seconds
  enableAI: boolean;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 20,
  boardWidth: 8,
  boardHeight: 8,
  initialAnimalsPerPlayer: 4,
  turnTimeLimit: 60,
  enableAI: false
};

export interface MoveValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface AnimalAbility {
  name: string;
  description: string;
  cooldown: number;
  range: number;
  execute: (
    animal: Animal,
    target: Position,
    board: GameBoard
  ) => {
    success: boolean;
    scoreChange: number;
    affectedAnimals: Animal[];
  };
}
