import {
  Card,
  CardType,
  SpecialCardType,
  Player,
  PlayerHand,
  TarzanEffect,
  ElephantEffect,
  AnimalFriendsEffect,
  SpecialEffect,
  GameState
} from './types';

/**
 * 특수 카드 능력 처리 클래스
 */
export class SpecialAbilities {
  /**
   * 타잔 카드 능력: 모두 바꿔!!
   * - 모든 플레이어가 순서대로 카드를 교체
   * - 마지막 플레이어의 카드는 버린 카드 더미로 이동
   */
  static executeTarzanAbility(
    players: Player[],
    startPlayerIndex: number,
    tarzanCard: Card,
    tarzanPosition: number,
    discardPile: Card[]
  ): { tarzanChain: TarzanEffect; updatedPlayers: Player[] } {
    const chainOrder = [];
    const swappedCards = new Map<string, Card>();

    // 타잔을 뽑은 플레이어부터 왼쪽으로 순회
    let currentCard = tarzanCard;
    let currentPlayerIndex = startPlayerIndex;

    for (let i = 0; i < players.length; i++) {
      const player = players[currentPlayerIndex];
      chainOrder.push(player.id);

      // 현재 플레이어가 가진 카드를 교체
      const oldCard = player.hand.cards[tarzanPosition];
      swappedCards.set(player.id, oldCard);

      // 타잔 또는 이전 플레이어의 카드를 받아서 배치
      player.hand.cards[tarzanPosition] = currentCard;

      // 다음 순회를 위해 현재 카드를 교체된 카드로 업데이트
      currentCard = oldCard;

      // 다음 플레이어로 이동 (왼쪽)
      currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
    }

    // 마지막 교체 카드를 버린 카드 더미에 추가
    discardPile.push(currentCard);

    const tarzanEffect: TarzanEffect = {
      type: 'tarzan_swap',
      chainOrder,
      swappedCards
    };

    return {
      tarzanChain: tarzanEffect,
      updatedPlayers: players
    };
  }

  /**
   * 코끼리 카드 능력: 하나만 보자!
   * - 자신의 뒷면 카드 1장을 혼자만 공개
   */
  static executeElephantAbility(
    player: Player,
    selectedCardIndex: number
  ): ElephantEffect {
    const selectedCard = player.hand.cards[selectedCardIndex];

    // 카드를 공개하되, 다른 플레이어에게는 보이지 않음
    player.hand.elephantRevealedCard = selectedCard;

    const elephantEffect: ElephantEffect = {
      type: 'elephant_reveal',
      playerId: player.id,
      revealedCardIndex: selectedCardIndex,
      revealedCard: selectedCard
    };

    return elephantEffect;
  }

  /**
   * 동물친구들 카드 능력: 복사카드!
   * - 라운드 종료 시 양옆 카드의 숫자를 복사
   * - 가운데에 있으면 양쪽 중 하나 선택
   * - 양 끝에 있으면 한쪽만 복사 가능
   */
  static getAnimalFriendsValue(
    cards: Card[],
    animalFriendsIndex: number,
    selectedChoice?: number
  ): { value: number; effect: AnimalFriendsEffect } {
    const col = animalFriendsIndex % 3;
    const isTop = animalFriendsIndex < 3;

    let leftCard: Card | undefined;
    let rightCard: Card | undefined;
    let copiedValue = 0;

    // 위아래 카드의 양옆 찾기
    if (isTop) {
      // 위쪽 카드
      if (col > 0) leftCard = cards[col - 1];
      if (col < 2) rightCard = cards[col + 1];
    } else {
      // 아래쪽 카드
      if (col > 0) leftCard = cards[col + 2]; // 3 + (col - 1)
      if (col < 2) rightCard = cards[col + 4]; // 3 + (col + 1)
    }

    // 위치별로 복사 로직 적용
    if (col === 0) {
      // 왼쪽 끝: 오른쪽만 복사 가능
      copiedValue = rightCard?.value ?? 0;
    } else if (col === 2) {
      // 오른쪽 끝: 왼쪽만 복사 가능
      copiedValue = leftCard?.value ?? 0;
    } else {
      // 가운데: 양쪽 중 선택 (낮은 값 선택하거나 플레이어 선택)
      if (leftCard && rightCard) {
        copiedValue = selectedChoice === 0
          ? leftCard.value
          : rightCard.value;
      } else if (leftCard) {
        copiedValue = leftCard.value;
      } else if (rightCard) {
        copiedValue = rightCard.value;
      }
    }

    const effect: AnimalFriendsEffect = {
      type: 'animal_friends_copy',
      position: animalFriendsIndex,
      copiedValue,
      adjacentCards: { left: leftCard, right: rightCard }
    };

    return { value: copiedValue, effect };
  }

  /**
   * 라운드 종료 시 점수 계산에서 동물친구들 카드 처리
   */
  static calculateScoreWithAnimalFriends(
    cards: Card[]
  ): {
    score: number;
    animalFriendsEffects: AnimalFriendsEffect[];
  } {
    let totalScore = 0;
    const animalFriendsEffects: AnimalFriendsEffect[] = [];

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

      // 각 카드의 실제 점수 계산
      const topValue = this.getCardScore(cards, topIndex, animalFriendsEffects);
      const bottomValue = this.getCardScore(cards, bottomIndex, animalFriendsEffects);

      totalScore += topValue + bottomValue;
    }

    return { score: totalScore, animalFriendsEffects };
  }

  /**
   * 개별 카드의 점수값 반환
   */
  private static getCardScore(
    cards: Card[],
    cardIndex: number,
    effectsList: AnimalFriendsEffect[]
  ): number {
    const card = cards[cardIndex];

    // 동물친구들 카드인 경우
    if (card.specialType === SpecialCardType.ANIMAL_FRIENDS) {
      const { value, effect } = this.getAnimalFriendsValue(cards, cardIndex);
      effectsList.push(effect);
      return value;
    }

    return card.value;
  }

  /**
   * 타잔 카드 사용 가능 여부 확인
   */
  static isTarzanPlayable(card: Card): boolean {
    return card.type === CardType.SPECIAL && card.specialType === SpecialCardType.TARZAN;
  }

  /**
   * 코끼리 카드 사용 가능 여부 확인
   */
  static isElephantPlayable(card: Card, hand: PlayerHand): boolean {
    const isElephant = card.type === CardType.SPECIAL && card.specialType === SpecialCardType.ELEPHANT;
    // 뒷면인 카드가 있어야 코끼리 카드를 사용 가능
    const hasUnrevealedCards = hand.cards.some(
      (c, idx) => !hand.revealedPositions.includes(idx)
    );
    return isElephant && hasUnrevealedCards;
  }

  /**
   * 동물친구들 카드인지 확인
   */
  static isAnimalFriendsCard(card: Card): boolean {
    return card.type === CardType.SPECIAL && card.specialType === SpecialCardType.ANIMAL_FRIENDS;
  }

  /**
   * 특수 카드의 가독성 있는 설명 반환
   */
  static getSpecialCardDescription(specialType: SpecialCardType | undefined): string {
    switch (specialType) {
      case SpecialCardType.TARZAN:
        return '타잔 카드 - 모든 플레이어가 차례로 카드를 교체합니다!';
      case SpecialCardType.ELEPHANT:
        return '코끼리 카드 - 뒷면인 자신의 카드 1장을 몰래 공개합니다!';
      case SpecialCardType.ANIMAL_FRIENDS:
        return '동물친구들 카드 - 양옆 카드의 숫자를 복사합니다!';
      default:
        return '일반 숫자 카드';
    }
  }

  /**
   * 특수 카드 배치 위치 유효성 확인
   */
  static isValidSpecialCardPosition(
    card: Card,
    position: number,
    gameState: GameState
  ): { valid: boolean; reason?: string } {
    // 타잔: 모든 위치 가능
    if (card.specialType === SpecialCardType.TARZAN) {
      return { valid: true };
    }

    // 코끼리: 모든 위치 가능
    if (card.specialType === SpecialCardType.ELEPHANT) {
      return { valid: true };
    }

    // 동물친구들: 모든 위치 가능 (양옆 카드가 필요하지만, 라운드 종료 시만 확인)
    if (card.specialType === SpecialCardType.ANIMAL_FRIENDS) {
      return { valid: true };
    }

    return { valid: true };
  }
}
