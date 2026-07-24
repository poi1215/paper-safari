import {
  GameState,
  Card,
  Player,
  CardType,
  SpecialCardType,
  GameStatus,
  PlayerHand,
  GameConfig,
  DEFAULT_GAME_CONFIG,
  GameAction,
  ActionType,
  RoundResult,
  SpecialEffect
} from './types';
import { SpecialAbilities } from './SpecialAbilities';

/**
 * Paper Safari Game Engine
 * 카드 기반의 숫자 합 비교 게임
 */
export class GameEngine {
  private gameState: GameState;
  private config: GameConfig;
  private deck: Card[] = [];
  private discardPile: Card[] = [];
  private roundResults: RoundResult[] = [];

  constructor(playerNames: string[], config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_GAME_CONFIG, ...config };
    this.gameState = this.initializeGame(playerNames);
  }

  /**
   * 게임 초기화
   */
  private initializeGame(playerNames: string[]): GameState {
    this.createDeck();
    this.shuffleDeck();

    const players: Player[] = playerNames.map((name, index) => ({
      id: `player_${index}`,
      name,
      scoreTokens: 0,
      hand: this.dealHand(),
      isActive: true
    }));

    // 버린 카드 더미에서 첫 카드 공개
    const firstDiscard = this.deck.pop()!;
    this.discardPile.push(firstDiscard);

    return {
      id: this.generateGameId(),
      status: 'playing' as GameStatus,
      currentRound: 1,
      currentPlayerIndex: 0,
      players,
      deck: this.deck,
      discardPile: this.discardPile,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * 카드 더미 생성 (0~10 각 4장, 타잔 4장, 코끼리 4장, 동물친구들 2장)
   */
  private createDeck(): void {
    this.deck = [];

    // 숫자 카드 (0-10)
    for (let num = 0; num <= 10; num++) {
      for (let i = 0; i < 4; i++) {
        this.deck.push({
          id: `card_${num}_${i}`,
          type: CardType.NUMBER,
          value: num,
          specialType: undefined,
          isRevealed: false
        });
      }
    }

    // 타잔 카드 (값: 10)
    for (let i = 0; i < 4; i++) {
      this.deck.push({
        id: `tarzan_${i}`,
        type: CardType.SPECIAL,
        value: 10,
        specialType: SpecialCardType.TARZAN,
        isRevealed: false
      });
    }

    // 코끼리 카드
    for (let i = 0; i < 4; i++) {
      this.deck.push({
        id: `elephant_${i}`,
        type: CardType.SPECIAL,
        value: 10,
        specialType: SpecialCardType.ELEPHANT,
        isRevealed: false
      });
    }

    // 동물 친구들 카드 (복사 카드)
    for (let i = 0; i < 2; i++) {
      this.deck.push({
        id: `animal_friends_${i}`,
        type: CardType.SPECIAL,
        value: 0,
        specialType: SpecialCardType.ANIMAL_FRIENDS,
        isRevealed: false
      });
    }
  }

  /**
   * 덱 섞기
   */
  private shuffleDeck(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * 플레이어에게 6장 배분
   */
  private dealHand(): PlayerHand {
    const cards: Card[] = [];
    for (let i = 0; i < 6; i++) {
      cards.push(this.deck.pop()!);
    }

    return {
      cards,
      revealedPositions: []
    };
  }

  /**
   * 카드 뽑기 - 덱 또는 버린 카드 더미에서
   */
  public drawCard(fromDiscard: boolean): Card {
    if (fromDiscard) {
      return this.discardPile[this.discardPile.length - 1];
    }

    // 덱이 비었으면 버린 카드 더미를 새로운 덱으로 사용
    if (this.deck.length === 0) {
      this.reshuffleDeck();
    }

    const card = this.deck.pop()!;
    card.isRevealed = true;
    return card;
  }

  /**
   * 버린 카드 더미를 새로운 덱으로 재구성
   */
  private reshuffleDeck(): void {
    if (this.discardPile.length <= 1) return;

    // 맨 위 카드는 남겨두고 나머지를 섞어서 새로운 덱 생성
    const topCard = this.discardPile.pop()!;
    this.deck = this.discardPile;
    this.shuffleDeck();
    this.discardPile = [topCard];
  }

  /**
   * 카드 바꾸기
   */
  public swapCard(
    playerId: string,
    newCard: Card,
    handPosition: number,
    fromDiscard: boolean
  ): { success: boolean; message: string; specialCardUsed?: SpecialCardType } {
    const playerIndex = this.gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, message: 'Player not found' };
    }

    const player = this.gameState.players[playerIndex];

    // 타잔 카드인 경우 특수 처리
    if (newCard.specialType === SpecialCardType.TARZAN) {
      return this.handleTarzanCard(playerIndex, newCard, handPosition, fromDiscard);
    }

    // 코끼리 카드인 경우
    if (newCard.specialType === SpecialCardType.ELEPHANT) {
      return this.handleElephantCard(player, newCard, handPosition, fromDiscard);
    }

    // 일반적인 카드 교체
    const oldCard = player.hand.cards[handPosition];
    player.hand.cards[handPosition] = newCard;

    if (fromDiscard) {
      this.discardPile.pop(); // 가져온 카드 제거
    }
    this.discardPile.push(oldCard); // 교체된 카드 추가

    // 뒷면 카드를 공개된 카드로 교체한 경우 자동 공개
    if (!player.hand.revealedPositions.includes(handPosition)) {
      player.hand.revealedPositions.push(handPosition);
    }

    return { success: true, message: 'Card swapped successfully' };
  }

  /**
   * 타잔 카드 처리 - 모든 플레이어가 순회하며 카드 교체
   */
  private handleTarzanCard(
    startPlayerIndex: number,
    tarzanCard: Card,
    tarzanPosition: number,
    fromDiscard: boolean
  ): { success: boolean; message: string; specialCardUsed?: SpecialCardType } {
    try {
      const { tarzanChain, updatedPlayers } = SpecialAbilities.executeTarzanAbility(
        this.gameState.players,
        startPlayerIndex,
        tarzanCard,
        tarzanPosition,
        this.discardPile
      );

      if (fromDiscard) {
        this.discardPile.pop();
      }

      // 기록
      const action: GameAction = {
        playerId: this.gameState.players[startPlayerIndex].id,
        timestamp: new Date(),
        actionType: ActionType.USE_SPECIAL_ABILITY,
        details: { specialCard: 'TARZAN', effect: tarzanChain }
      };
      this.gameState.history.push(action);

      return {
        success: true,
        message: '타잔 카드! 모든 플레이어의 카드가 교체되었습니다!',
        specialCardUsed: SpecialCardType.TARZAN
      };
    } catch (error) {
      return { success: false, message: 'Failed to execute Tarzan card effect' };
    }
  }

  /**
   * 코끼리 카드 처리 - 뒷면 카드 1장 공개
   */
  private handleElephantCard(
    player: Player,
    elephantCard: Card,
    handPosition: number,
    fromDiscard: boolean
  ): { success: boolean; message: string; specialCardUsed?: SpecialCardType } {
    // 뒷면 카드가 있는지 확인
    const unrevealedPositions = player.hand.cards
      .map((_, idx) => idx)
      .filter(idx => !player.hand.revealedPositions.includes(idx));

    if (unrevealedPositions.length === 0) {
      return { success: false, message: '공개할 뒷면 카드가 없습니다.' };
    }

    // 코끼리 카드를 손에 배치
    const oldCard = player.hand.cards[handPosition];
    player.hand.cards[handPosition] = elephantCard;

    if (fromDiscard) {
      this.discardPile.pop();
    }
    this.discardPile.push(oldCard);

    // 플레이어가 뒷면 카드 중 하나를 선택하여 공개할 수 있도록 표시
    // (프론트엔드에서 선택 후 revealElephantCard 메서드 호출)

    return {
      success: true,
      message: '코끼리 카드! 뒷면 카드 1장을 선택하여 공개하세요.',
      specialCardUsed: SpecialCardType.ELEPHANT
    };
  }

  /**
   * 코끼리 카드로 뒷면 카드 공개
   */
  public revealElephantCard(playerId: string, cardIndex: number): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      SpecialAbilities.executeElephantAbility(player, cardIndex);
    }
  }

  /**
   * 카드 공개
   */
  public revealCard(playerId: string, position: number): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player && !player.hand.revealedPositions.includes(position)) {
      player.hand.revealedPositions.push(position);
      player.hand.cards[position].isRevealed = true;
    }
  }

  /**
   * 라운드 종료 - 점수 계산
   */
  public endRound(): RoundResult {
    const scores = new Map<string, number>();
    const specialEffectsUsed: SpecialEffect[] = [];

    // 각 플레이어의 점수 계산 (동물친구들 카드 고려)
    this.gameState.players.forEach(player => {
      const { score, animalFriendsEffects } =
        SpecialAbilities.calculateScoreWithAnimalFriends(player.hand.cards);
      scores.set(player.id, score);
      specialEffectsUsed.push(...animalFriendsEffects);
    });

    // 최저 점수 플레이어 찾기
    let minScore = Infinity;
    let winners: Player[] = [];

    scores.forEach((score, playerId) => {
      const player = this.gameState.players.find(p => p.id === playerId)!;
      if (score < minScore) {
        minScore = score;
        winners = [player];
      } else if (score === minScore) {
        winners.push(player);
      }
    });

    // 동점일 경우 높은 카드 비교로 우승자 결정
    let winner = winners[0];
    if (winners.length > 1) {
      winner = this.resolveTiebreaker(winners, scores);
    }

    winner.scoreTokens++;

    const roundResult: RoundResult = {
      winnerId: winner.id,
      winnerName: winner.name,
      scores,
      specialEffectsUsed
    };

    this.roundResults.push(roundResult);
    this.gameState.status = 'roundEnd';

    return roundResult;
  }

  /**
   * 동점 해제 로직 - 높은 카드부터 비교
   */
  private resolveTiebreaker(winners: Player[], scores: Map<string, number>): Player {
    // 각 플레이어의 카드를 내림차순으로 정렬
    const playerCards = winners.map(player => ({
      player,
      cards: player.hand.cards
        .map(c => c.value)
        .sort((a, b) => b - a) // 내림차순
    }));

    // 높은 카드부터 비교
    for (let i = 0; i < 6; i++) {
      let maxCardValue = -Infinity;
      let winner: Player | null = null;

      for (const { player, cards } of playerCards) {
        if (cards[i] > maxCardValue) {
          maxCardValue = cards[i];
          winner = player;
        }
      }

      // 이 순위에서 다른 카드가 있으면 우승자 결정
      const playersWithMaxCard = playerCards.filter(
        pc => pc.cards[i] === maxCardValue
      );
      if (playersWithMaxCard.length === 1) {
        return winner!;
      }
    }

    return winners[0]; // 모두 같으면 첫 번째 반환
  }

  /**
   * 새로운 라운드 시작
   */
  public startNewRound(startingPlayerId: string): void {
    // 카드 재분배
    this.deck = [];
    this.discardPile = [];
    this.createDeck();
    this.shuffleDeck();

    // 각 플레이어의 손에 새 카드 배분
    this.gameState.players.forEach(player => {
      player.hand = this.dealHand();
    });

    // 시작 플레이어 설정 (점수를 획득한 플레이어부터 시작)
    const startingPlayerIndex = this.gameState.players.findIndex(
      p => p.id === startingPlayerId
    );
    this.gameState.currentPlayerIndex = startingPlayerIndex;

    // 버린 카드 더미의 첫 카드
    const firstDiscard = this.deck.pop()!;
    this.discardPile.push(firstDiscard);

    this.gameState.currentRound++;
    this.gameState.status = 'playing';
    this.gameState.updatedAt = new Date();
  }

  /**
   * 게임 종료 확인
   */
  public isGameOver(): boolean {
    return this.gameState.players.some(p => p.scoreTokens >= 3);
  }

  /**
   * 게임 우승자 반환
   */
  public getWinner(): Player | null {
    return this.gameState.players.find(p => p.scoreTokens >= 3) || null;
  }

  /**
   * 현재 플레이어
   */
  public getCurrentPlayer(): Player {
    return this.gameState.players[this.gameState.currentPlayerIndex];
  }

  /**
   * 다음 플레이어로 턴 이동
   */
  public nextTurn(): void {
    this.gameState.currentPlayerIndex =
      (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
    this.gameState.updatedAt = new Date();
  }

  /**
   * 게임 상태 반환
   */
  public getState(): GameState {
    return this.gameState;
  }

  /**
   * 라운드 결과 반환
   */
  public getRoundResults(): RoundResult[] {
    return this.roundResults;
  }

  /**
   * 게임 ID 생성
   */
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 게임 상태를 JSON으로 직렬화
   */
  public toJSON() {
    return {
      gameState: this.gameState,
      roundResults: this.roundResults
    };
  }
}
