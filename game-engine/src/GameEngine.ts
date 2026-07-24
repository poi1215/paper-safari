import {
  GameState,
  GameBoard,
  Player,
  Animal,
  Position,
  GameAction,
  ActionType,
  AnimalType,
  TerrainType,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  MoveValidationResult
} from './types';

/**
 * Core Game Engine for Paper Safari
 */
export class GameEngine {
  private gameState: GameState;
  private config: GameConfig;

  constructor(players: Player[], config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_GAME_CONFIG, ...config };
    this.gameState = this.initializeGame(players);
  }

  /**
   * Initialize game state
   */
  private initializeGame(players: Player[]): GameState {
    const board = this.createBoard(this.config.boardWidth, this.config.boardHeight);
    
    // Place animals on board
    players.forEach((player, index) => {
      this.placePlayerAnimals(player, board, index);
    });

    return {
      id: this.generateGameId(),
      status: 'waiting',
      currentRound: 1,
      currentPlayerIndex: 0,
      players,
      board,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create game board with random terrain
   */
  private createBoard(width: number, height: number): GameBoard {
    const tiles = Array(height)
      .fill(null)
      .map((_, y) =>
        Array(width)
          .fill(null)
          .map((_, x) => ({
            position: { x, y },
            terrain: this.randomTerrain(),
            animal: undefined
          }))
      );

    return { width, height, tiles };
  }

  /**
   * Generate random terrain type
   */
  private randomTerrain(): TerrainType {
    const terrains = Object.values(TerrainType);
    return terrains[Math.floor(Math.random() * terrains.length)];
  }

  /**
   * Place animals for a player at starting positions
   */
  private placePlayerAnimals(player: Player, board: GameBoard, playerIndex: number): void {
    const startX = playerIndex % 2 === 0 ? 1 : board.width - 2;
    const startY = playerIndex < 2 ? 1 : board.height - 2;

    const animalTypes = [AnimalType.LION, AnimalType.ZEBRA, AnimalType.GIRAFFE, AnimalType.ELEPHANT];

    animalTypes.forEach((type, i) => {
      const animal: Animal = {
        id: `${player.id}-${type}`,
        type,
        playerId: player.id,
        position: { x: startX + (i % 2), y: startY + Math.floor(i / 2) },
        health: 100,
        abilities: this.getAnimalAbilities(type)
      };

      player.animals.push(animal);
      const tile = board.tiles[animal.position.y][animal.position.x];
      tile.animal = animal;
    });
  }

  /**
   * Get abilities for animal type
   */
  private getAnimalAbilities(type: AnimalType): string[] {
    switch (type) {
      case AnimalType.LION:
        return ['hunt'];
      case AnimalType.ZEBRA:
        return ['sprint'];
      case AnimalType.GIRAFFE:
        return ['reach'];
      case AnimalType.ELEPHANT:
        return ['push'];
      default:
        return [];
    }
  }

  /**
   * Process player move action
   */
  public moveAnimal(
    playerId: string,
    animalId: string,
    targetPosition: Position
  ): GameAction {
    const currentPlayer = this.getCurrentPlayer();
    
    if (currentPlayer.id !== playerId) {
      return {
        playerId,
        timestamp: new Date(),
        actionType: ActionType.MOVE,
        animalId,
        targetPosition,
        result: {
          success: false,
          scoreChange: 0,
          message: 'Not your turn'
        }
      };
    }

    const animal = currentPlayer.animals.find(a => a.id === animalId);
    if (!animal) {
      return {
        playerId,
        timestamp: new Date(),
        actionType: ActionType.MOVE,
        animalId,
        targetPosition,
        result: {
          success: false,
          scoreChange: 0,
          message: 'Animal not found'
        }
      };
    }

    const validation = this.validateMove(animal, targetPosition);
    if (!validation.isValid) {
      return {
        playerId,
        timestamp: new Date(),
        actionType: ActionType.MOVE,
        animalId,
        targetPosition,
        result: {
          success: false,
          scoreChange: 0,
          message: validation.reason || 'Invalid move'
        }
      };
    }

    // Execute move
    const scoreChange = this.executeMove(animal, targetPosition);

    const action: GameAction = {
      playerId,
      timestamp: new Date(),
      actionType: ActionType.MOVE,
      animalId,
      targetPosition,
      result: {
        success: true,
        scoreChange,
        message: 'Move successful'
      }
    };

    this.gameState.history.push(action);
    this.gameState.updatedAt = new Date();

    return action;
  }

  /**
   * Validate if move is possible
   */
  private validateMove(animal: Animal, targetPosition: Position): MoveValidationResult {
    // Check bounds
    if (
      targetPosition.x < 0 ||
      targetPosition.x >= this.gameState.board.width ||
      targetPosition.y < 0 ||
      targetPosition.y >= this.gameState.board.height
    ) {
      return { isValid: false, reason: 'Target out of bounds' };
    }

    // Check distance (adjacent or based on ability)
    const distance = Math.max(
      Math.abs(animal.position.x - targetPosition.x),
      Math.abs(animal.position.y - targetPosition.y)
    );

    const maxDistance = animal.type === AnimalType.ZEBRA ? 2 : 1;
    if (distance > maxDistance) {
      return { isValid: false, reason: 'Target too far' };
    }

    // Check terrain accessibility
    const targetTile = this.gameState.board.tiles[targetPosition.y][targetPosition.x];
    if (!this.canAccessTerrain(animal.type, targetTile.terrain)) {
      return { isValid: false, reason: 'Cannot access this terrain' };
    }

    return { isValid: true };
  }

  /**
   * Check if animal can access terrain type
   */
  private canAccessTerrain(animalType: AnimalType, terrain: TerrainType): boolean {
    // Water is only accessible to certain animals (can be expanded)
    if (terrain === TerrainType.WATER) {
      return [AnimalType.ZEBRA].includes(animalType);
    }
    return true;
  }

  /**
   * Execute move and return score change
   */
  private executeMove(animal: Animal, targetPosition: Position): number {
    const oldTile = this.gameState.board.tiles[animal.position.y][animal.position.x];
    const newTile = this.gameState.board.tiles[targetPosition.y][targetPosition.x];

    let scoreChange = 0;

    // Remove animal from old position
    oldTile.animal = undefined;

    // Handle interaction with existing animal
    if (newTile.animal) {
      const result = this.handleAnimalInteraction(animal, newTile.animal);
      scoreChange += result;
      
      // Remove target animal if caught
      if (animal.type === AnimalType.LION && newTile.animal === newTile.animal) {
        const player = this.gameState.players.find(p => p.id === newTile.animal?.playerId);
        if (player) {
          newTile.animal = undefined;
        }
      }
    }

    // Place animal at new position
    newTile.animal = animal;
    animal.position = targetPosition;

    return scoreChange;
  }

  /**
   * Handle animal interaction
   */
  private handleAnimalInteraction(attacker: Animal, defender: Animal): number {
    // Same species bonus
    if (attacker.type === defender.type) {
      return 1;
    }

    // Lion catches other animals
    if (attacker.type === AnimalType.LION) {
      return 2;
    }

    // Default interaction
    return 0;
  }

  /**
   * End current turn and move to next player
   */
  public endTurn(): void {
    const totalPlayers = this.gameState.players.length;
    this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % totalPlayers;

    // Check if round is complete
    if (this.gameState.currentPlayerIndex === 0) {
      this.gameState.currentRound++;
    }

    // Check if game is over
    if (this.gameState.currentRound > this.config.maxRounds) {
      this.gameState.status = 'finished';
    }

    this.gameState.updatedAt = new Date();
  }

  /**
   * Get current game state
   */
  public getState(): GameState {
    return this.gameState;
  }

  /**
   * Get current player
   */
  public getCurrentPlayer(): Player {
    return this.gameState.players[this.gameState.currentPlayerIndex];
  }

  /**
   * Get game results (sorted by score)
   */
  public getResults(): Player[] {
    return [...this.gameState.players].sort((a, b) => b.score - a.score);
  }

  /**
   * Generate unique game ID
   */
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
