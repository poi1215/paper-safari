import {
  GameState,
  Card,
  Player,
  CardType,
  SpecialCardType,
  GameStatus,
  PlayerHand,
  GameConfig,
  DEFAULT_GAME_CONFIG
} from './types';

/**
 * Paper Safari Game Engine
 * 카드 기반의 숫자 합 비교 게임
 */
export class GameEngine {
  private gameState: GameState;
  private config: GameConfig;
  private deck: Card[] = [];
  private discardPile: Card[] = [];

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
  ): { success: boolean; message: string } {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // 버린 카드 더미에서 가져온 경우 반드시 교체해야 함
    if (fromDiscard) {
      const oldCard = player.hand.cards[handPosition];
      player.hand.cards[handPosition] = newCard;
      this.discardPile.pop(); // 가져온 카드 제거
      this.discardPile.push(oldCard); // 교체된 카드 추가

      return { success: true, message: 'Card swapped successfully' };
    }

    // 덱에서 가져온 경우 선택적으로 교체 가능
    const oldCard = player.hand.cards[handPosition];
    player.hand.cards[handPosition] = newCard;
    this.discardPile.push(oldCard);

    return { success: true, message: 'Card swapped successfully' };
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
  public endRound(): { winner: Player; scores: Map<string, number> } {
    const scores = new Map<string, number>();

    // 각 플레이어의 점수 계산
    this.gameState.players.forEach(player => {
      const score = this.calculateScore(player.hand.cards);
      scores.set(player.id, score);
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
      winner = this.resolveTebybreak(winners, scores);
    }

    winner.scoreTokens++;

    return { winner, scores };
  }

  /**
   * 점수 계산 로직
   * - 같은 행의 위/아래 카드가 같은 숫자면 그 열은 0점
   * - 동물친구들 카드는 양옆 카드의 숫자 복사
   */
  private calculateScore(cards: Card[]): number {
    let totalScore = 0;

    // 3개 열 (각 열은 위아래 2장)
    for (let col = 0; col < 3; col++) {
      const topIndex = col;
      const bottomIndex = col + 3;

      const topCard = cards[topIndex];
      const bottomCard = cards[bottomIndex];

      // 위/아래가 같은 숫자면 0점
      if (topCard.value === bottomCard.value) {
        continue; // 이 열은 0점
      }

      // 동물친구들 카드 처리
      const topValue = this.getCardValue(topCard, col, true);
      const bottomValue = this.getCardValue(bottomCard, col, false);

      totalScore += topValue + bottomValue;
    }

    return totalScore;
  }

  /**
   * 카드의 실제 점수값 반환 (동물친구들 카드 처리)
   */
  private getCardValue(card: Card, col: number, isTop: boolean): number {
    if (card.specialType !== SpecialCardType.ANIMAL_FRIENDS) {
      return card.value;
    }

    // 동물친구들 카드는 양옆 카드의 값을 복사
    if (col === 0) {
      // 왼쪽 끝: 아래 카드만 복사 가능
      return this.gameState.players[0].hand.cards[3].value;
    } else if (col === 2) {
      // 오른쪽 끝: 위 카드만 복사 가능
      return this.gameState.players[0].hand.cards[2].value;
    } else {
      // 가운데: 양쪽 중 선택 가능 (더 낮은 값 선택)
      const left = this.gameState.players[0].hand.cards[col - 1].value;
      const right = this.gameState.players[0].hand.cards[col + 1].value;
      return Math.min(left, right);
    }
  }

  /**
   * 동점 해제 로직 - 높은 카드부터 비교
   */
  private resolveTebybreak(winners: Player[], scores: Map<string, number>): Player {
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
  }

  /**
   * 게임 상태 반환
   */
  public getState(): GameState {
    return this.gameState;
  }

  /**
   * 게임 ID 생성
   */
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
