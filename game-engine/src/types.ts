/**
 * Paper Safari Card Game Types
 */

export enum CardType {
  NUMBER = 'number',
  SPECIAL = 'special'
}

export enum SpecialCardType {
  TARZAN = 'tarzan',           // 모두 바꿔!!
  ELEPHANT = 'elephant',       // 하나만 보자!
  ANIMAL_FRIENDS = 'animal_friends' // 복사카드!
}

export interface Card {
  id: string;
  type: CardType;
  value: number; // 0-10 또는 특수 카드의 기본값
  specialType?: SpecialCardType;
  isRevealed: boolean;
}

export interface PlayerHand {
  cards: Card[]; // 6장 (위아래 3줄)
  revealedPositions: number[]; // 공개된 카드의 인덱스
  elephantRevealedCard?: Card; // 코끼리 능력으로 본 카드
}

export interface Player {
  id: string;
  name: string;
  scoreTokens: number; // 0-3 (3이 되면 게임 우승)
  hand: PlayerHand;
  isActive: boolean;
}

export interface GameState {
  id: string;
  status: GameStatus;
  currentRound: number;
  currentPlayerIndex: number;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  history: GameAction[];
  createdAt: Date;
  updatedAt: Date;
  tarzanChainPlayers?: string[]; // 타잔 체인 진행 중인 플레이어들
}

export type GameStatus = 'waiting' | 'playing' | 'roundEnd' | 'gameEnd';

export interface GameAction {
  playerId: string;
  timestamp: Date;
  actionType: ActionType;
  details: Record<string, any>;
}

export enum ActionType {
  DRAW_CARD = 'draw_card',
  SWAP_CARD = 'swap_card',
  REVEAL_CARD = 'reveal_card',
  USE_SPECIAL_ABILITY = 'use_special_ability',
  ROUND_END = 'round_end',
  GAME_END = 'game_end'
}

export interface GameConfig {
  maxPlayers: number;
  minPlayers: number;
  pointsToWin: number; // 3점
  cardsPerHand: number; // 6장
  cardsPerRow: number; // 3열
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxPlayers: 4,
  minPlayers: 2,
  pointsToWin: 3,
  cardsPerHand: 6,
  cardsPerRow: 3
};

/**
 * 특수 카드 능력 관련 인터페이스
 */

export interface TarzanEffect {
  type: 'tarzan_swap';
  chainOrder: string[]; // 타잔을 받은 플레이어 순서
  swappedCards: Map<string, Card>; // 플레이어별 교체된 카드
}

export interface ElephantEffect {
  type: 'elephant_reveal';
  playerId: string;
  revealedCardIndex: number;
  revealedCard: Card;
}

export interface AnimalFriendsEffect {
  type: 'animal_friends_copy';
  position: number; // 0-5 (카드 위치)
  copiedValue: number; // 복사된 값
  adjacentCards: { left?: Card; right?: Card };
}

export type SpecialEffect = TarzanEffect | ElephantEffect | AnimalFriendsEffect;

/**
 * 라운드 결과
 */
export interface RoundResult {
  winnerId: string;
  winnerName: string;
  scores: Map<string, number>; // playerId -> 점수
  tiebreakers?: TiebreakerInfo;
  specialEffectsUsed: SpecialEffect[];
}

export interface TiebreakerInfo {
  winners: string[];
  highestCardComparison: {
    playerId: string;
    cards: number[];
  }[];
}

/**
 * 게임 결과
 */
export interface GameResult {
  winnerId: string;
  winnerName: string;
  finalScores: Map<string, number>; // playerId -> scoreTokens
  totalRounds: number;
  roundResults: RoundResult[];
}
