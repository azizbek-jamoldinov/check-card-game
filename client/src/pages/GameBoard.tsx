import { useEffect, useState, useCallback, FC } from 'react';
import { Box, Flex, Grid, Text, VStack, HStack, Badge, Heading, Progress } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Card } from '../components/cards/Card';
import { CardBack } from '../components/cards/CardBack';
import type { Card as CardType } from '../types/card.types';
import type { ClientHandSlot, ClientPlayerState } from '../types/player.types';
import type { PeekedCard } from '../types/game.types';

// ============================================================
// Constants
// ============================================================

const PEEK_DURATION_MS = 8000;
const PEEK_TICK_MS = 100;

// ============================================================
// Opponent Display
// ============================================================

interface OpponentProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
}

const OpponentRow: FC<OpponentProps> = ({ player, isCurrentTurn }) => {
  return (
    <VStack
      spacing={1}
      p={2}
      borderRadius="md"
      bg={isCurrentTurn ? 'whiteAlpha.200' : 'whiteAlpha.50'}
      border="1px solid"
      borderColor={isCurrentTurn ? 'yellow.400' : 'whiteAlpha.100'}
      minW={{ base: '100px', md: '140px' }}
    >
      <HStack spacing={1}>
        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="bold" noOfLines={1}>
          {player.username}
        </Text>
        {isCurrentTurn && (
          <Badge colorScheme="yellow" fontSize="2xs">
            Turn
          </Badge>
        )}
      </HStack>
      <HStack spacing={1}>
        {player.hand.map((h: ClientHandSlot) => (
          <Box
            key={h.slot}
            w={{ base: '20px', md: '28px' }}
            h={{ base: '28px', md: '39px' }}
            borderRadius="sm"
            bg="card.back"
            border="1px solid"
            borderColor="gray.600"
            opacity={h.card === undefined ? 0.3 : 1}
          />
        ))}
      </HStack>
      <Text fontSize="2xs" color="gray.400">
        Score: {player.totalScore}
      </Text>
    </VStack>
  );
};

// ============================================================
// Main GameBoard Component (F-031, F-094)
// ============================================================

export const GameBoard: FC = () => {
  const navigate = useNavigate();
  const { gameState, peekedCards, playerId, roomData } = useSocket();

  // Peek animation state
  const [isPeeking, setIsPeeking] = useState(true);
  const [peekProgress, setPeekProgress] = useState(100);

  // Redirect if no game state
  useEffect(() => {
    if (!gameState || !roomData) {
      navigate('/');
    }
  }, [gameState, roomData, navigate]);

  // 3-second peek countdown (F-031)
  useEffect(() => {
    if (!isPeeking || !peekedCards || peekedCards.length === 0) return;

    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, PEEK_DURATION_MS - elapsed);
      const progress = (remaining / PEEK_DURATION_MS) * 100;
      setPeekProgress(progress);

      if (remaining <= 0) {
        clearInterval(timer);
        setIsPeeking(false);
        setPeekProgress(0);
      }
    }, PEEK_TICK_MS);

    return () => clearInterval(timer);
  }, [isPeeking, peekedCards]);

  // Helper: is this slot being peeked?
  const isPeekedSlot = useCallback(
    (slot: string): boolean => {
      if (!isPeeking || !peekedCards) return false;
      return peekedCards.some((pc: PeekedCard) => pc.slot === slot);
    },
    [isPeeking, peekedCards],
  );

  // Helper: get peeked card data for a slot
  const getPeekedCardForSlot = useCallback(
    (slot: string): CardType | null => {
      if (!isPeeking || !peekedCards) return null;
      const peeked = peekedCards.find((pc: PeekedCard) => pc.slot === slot);
      return peeked?.card ?? null;
    },
    [isPeeking, peekedCards],
  );

  if (!gameState || !playerId) {
    return null;
  }

  // Find current player and opponents
  const myPlayer = gameState.players.find((p) => p.playerId === playerId);
  const opponents = gameState.players.filter((p) => p.playerId !== playerId);
  const topDiscard =
    gameState.discardPile.length > 0
      ? gameState.discardPile[gameState.discardPile.length - 1]
      : null;

  if (!myPlayer) {
    return null;
  }

  return (
    <Box minH="100vh" bg="gray.900" display="flex" flexDirection="column" position="relative">
      {/* Peek overlay / countdown */}
      {isPeeking && peekedCards && peekedCards.length > 0 && (
        <Box position="fixed" top={0} left={0} right={0} zIndex={10} px={4} pt={2}>
          <VStack spacing={1}>
            <Text fontSize="sm" color="yellow.300" fontWeight="bold">
              Memorize your cards!
            </Text>
            <Progress
              value={peekProgress}
              size="sm"
              colorScheme="yellow"
              w="200px"
              borderRadius="full"
              bg="gray.700"
            />
            <Text fontSize="xs" color="gray.400">
              {Math.ceil((peekProgress / 100) * (PEEK_DURATION_MS / 1000))}s remaining
            </Text>
          </VStack>
        </Box>
      )}

      {/* Score / Round info */}
      <Flex
        px={4}
        py={2}
        bg="gray.800"
        borderBottom="1px solid"
        borderColor="gray.700"
        justify="space-between"
        align="center"
        flexShrink={0}
      >
        <HStack spacing={3}>
          <Text fontSize="sm" color="gray.400">
            Room:{' '}
            <Text as="span" color="gray.100" fontWeight="bold">
              {roomData?.roomCode}
            </Text>
          </Text>
          <Text fontSize="sm" color="gray.400">
            Round:{' '}
            <Text as="span" color="gray.100" fontWeight="bold">
              {gameState.roundNumber}
            </Text>
          </Text>
        </HStack>
        <Text fontSize="sm" color="gray.400">
          Phase:{' '}
          <Text as="span" color="gray.100" fontWeight="bold">
            {gameState.phase}
          </Text>
        </Text>
      </Flex>

      {/* Main game area */}
      <Grid
        flex={1}
        templateRows="auto 1fr auto"
        p={{ base: 2, md: 4 }}
        gap={{ base: 3, md: 4 }}
        maxW="900px"
        mx="auto"
        w="100%"
      >
        {/* Top: Opponents */}
        <Flex wrap="wrap" justify="center" gap={{ base: 2, md: 3 }}>
          {opponents.map((opp) => (
            <OpponentRow
              key={opp.playerId}
              player={opp}
              isCurrentTurn={
                gameState.players[gameState.currentTurnIndex]?.playerId === opp.playerId
              }
            />
          ))}
        </Flex>

        {/* Center: Draw pile and Discard pile */}
        <Flex justify="center" align="center" gap={{ base: 6, md: 10 }}>
          {/* Draw Pile */}
          <VStack spacing={2}>
            <CardBack size="md" />
            <Text fontSize="xs" color="gray.400">
              Deck ({gameState.deckCount})
            </Text>
          </VStack>

          {/* Discard Pile */}
          <VStack spacing={2}>
            {topDiscard ? (
              <Card card={topDiscard} />
            ) : (
              <Box
                w="80px"
                h="112px"
                borderRadius="md"
                border="2px dashed"
                borderColor="gray.600"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="xs" color="gray.500">
                  Empty
                </Text>
              </Box>
            )}
            <Text fontSize="xs" color="gray.400">
              Discard
            </Text>
          </VStack>
        </Flex>

        {/* Bottom: Player's hand */}
        <VStack spacing={3}>
          {/* Turn indicator */}
          {gameState.players[gameState.currentTurnIndex]?.playerId === playerId ? (
            <Heading size="sm" color="yellow.300">
              Your Turn
            </Heading>
          ) : (
            <Text fontSize="sm" color="gray.500">
              {gameState.players[gameState.currentTurnIndex]?.username}&apos;s turn
            </Text>
          )}

          {/* Hand */}
          <HStack spacing={{ base: 2, md: 3 }} justify="center">
            {myPlayer.hand.map((h: ClientHandSlot) => {
              const peekedCard = getPeekedCardForSlot(h.slot);
              const showFaceUp = isPeekedSlot(h.slot) && peekedCard !== null;
              const visibleCard = showFaceUp ? peekedCard : h.card;

              return (
                <VStack key={h.slot} spacing={1}>
                  {visibleCard ? (
                    <Card card={visibleCard} isSelected={isPeekedSlot(h.slot)} />
                  ) : (
                    <CardBack isSelected={isPeekedSlot(h.slot)} />
                  )}
                  <Badge colorScheme={isPeekedSlot(h.slot) ? 'yellow' : 'gray'} fontSize="xs">
                    {h.slot}
                  </Badge>
                </VStack>
              );
            })}
          </HStack>

          {/* Player info */}
          <Text fontSize="xs" color="gray.500">
            {myPlayer.username} | Score: {myPlayer.totalScore}
          </Text>
        </VStack>
      </Grid>
    </Box>
  );
};
