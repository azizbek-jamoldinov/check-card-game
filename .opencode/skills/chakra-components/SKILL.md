---
name: chakra-components
description: UI component conventions, Chakra UI patterns, file structure, responsive design, and styling guidelines for the Check Card Game
---

## Overview

The Check Card Game frontend uses React with TypeScript, Chakra UI as the component library, and Vite as the build tool. This skill defines the conventions for building consistent, responsive, and accessible UI components.

---

## Project Structure

```
client/src/
  components/         # Reusable UI components
    cards/            # Card-related components
      Card.tsx
      CardSlot.tsx
      CardBack.tsx
    game/             # Game board components
      PlayerHand.tsx
      OpponentDisplay.tsx
      DrawPile.tsx
      DiscardPile.tsx
      ActionButtons.tsx
      CheckButton.tsx
      ScorePanel.tsx
      TurnIndicator.tsx
    modals/           # Modal dialogs
      RedJackModal.tsx
      RedQueenModal.tsx
      RedKingModal.tsx
      RoundEndModal.tsx
      GameEndModal.tsx
      InitialPeekOverlay.tsx
    layout/           # Layout components
      GameLayout.tsx
      Header.tsx
  pages/              # Route pages
    HomePage.tsx
    RoomLobby.tsx
    GameBoard.tsx
  context/            # React Context providers
    GameContext.tsx
    SocketContext.tsx
  services/           # External service integrations
    socket.ts
  types/              # TypeScript type definitions
    card.types.ts
    game.types.ts
    player.types.ts
    socket.types.ts
  utils/              # Helper functions
    cardHelpers.ts
    formatters.ts
  theme/              # Chakra UI theme customization
    index.ts
    colors.ts
    components.ts
  App.tsx
  main.tsx
```

---

## Component Conventions

### File Naming

- Components: PascalCase (e.g., `PlayerHand.tsx`)
- Utilities: camelCase (e.g., `cardHelpers.ts`)
- Types: camelCase with `.types.ts` suffix (e.g., `game.types.ts`)
- One component per file
- Export components as named exports, not default

### Component Pattern

```tsx
import { Box, Text, Button } from '@chakra-ui/react';
import { FC } from 'react';

interface PlayerHandProps {
  cards: CardSlotData[];
  selectedSlot: string | null;
  onCardSelect: (slot: string) => void;
  isMyTurn: boolean;
}

export const PlayerHand: FC<PlayerHandProps> = ({
  cards,
  selectedSlot,
  onCardSelect,
  isMyTurn,
}) => {
  return (
    <Box
      display="flex"
      gap={3}
      justifyContent="center"
      p={4}
    >
      {cards.map((card) => (
        <CardSlot
          key={card.slot}
          card={card}
          isSelected={selectedSlot === card.slot}
          onClick={() => isMyTurn && onCardSelect(card.slot)}
          isDisabled={!isMyTurn}
        />
      ))}
    </Box>
  );
};
```

### Props Guidelines

- Always define a TypeScript interface for props
- Name interface as `ComponentNameProps`
- Use explicit types, avoid `any`
- Destructure props in function signature
- Provide sensible defaults where appropriate

---

## Chakra UI Usage

### Import Pattern

Always import Chakra components individually:

```tsx
// Good
import { Box, Flex, Text, Button, useToast } from '@chakra-ui/react';

// Avoid - don't import the entire module
import * as Chakra from '@chakra-ui/react';
```

### Layout Components

Use Chakra's layout primitives consistently:

```tsx
// Use Box for generic containers
<Box p={4} bg="gray.800" borderRadius="lg">

// Use Flex for flexbox layouts
<Flex align="center" justify="space-between" gap={4}>

// Use Grid for grid layouts (game board)
<Grid templateColumns="repeat(3, 1fr)" gap={4}>

// Use Stack/VStack/HStack for stacked layouts
<VStack spacing={4} align="stretch">
<HStack spacing={2}>
```

### Responsive Design

Use Chakra's responsive array or object syntax:

```tsx
// Array syntax (base, sm, md, lg, xl)
<Box fontSize={['sm', 'md', 'lg']} p={[2, 4, 6]}>

// Object syntax
<Box
  display={{ base: 'block', md: 'flex' }}
  width={{ base: '100%', lg: '80%' }}
>

// Game board specific breakpoints
<Grid
  templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
  templateRows={{ base: 'auto', md: '1fr 2fr 1fr' }}
>
```

### Color Mode

Support dark mode (default for a card game):

```tsx
import { useColorModeValue } from '@chakra-ui/react';

const bgColor = useColorModeValue('gray.100', 'gray.800');
const textColor = useColorModeValue('gray.800', 'gray.100');
const cardBg = useColorModeValue('white', 'gray.700');
```

---

## Theme Customization

### Custom Theme (`theme/index.ts`)

```tsx
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#e8f5e9',
      100: '#c8e6c9',
      // ... define full brand palette
      500: '#4caf50',  // Primary green for game table
      900: '#1b5e20',
    },
    card: {
      red: '#d32f2f',
      black: '#212121',
      back: '#1565c0',
      selected: '#ffd600',
    },
    table: {
      felt: '#2e7d32',
      border: '#1b5e20',
    },
  },
  fonts: {
    heading: `'Inter', sans-serif`,
    body: `'Inter', sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'gray.100',
      },
    },
  },
});

export default theme;
```

---

## Card Component Design

### Card Appearance

```tsx
// Card dimensions - maintain standard card ratio (2.5:3.5)
const CARD_WIDTH = { base: '60px', md: '80px', lg: '100px' };
const CARD_HEIGHT = { base: '84px', md: '112px', lg: '140px' };

// Face-up card
<Box
  w={CARD_WIDTH}
  h={CARD_HEIGHT}
  borderRadius="md"
  border="2px solid"
  borderColor={isSelected ? 'card.selected' : 'gray.600'}
  bg="white"
  color={card.isRed ? 'card.red' : 'card.black'}
  display="flex"
  flexDirection="column"
  alignItems="center"
  justifyContent="center"
  cursor={isClickable ? 'pointer' : 'default'}
  transition="all 0.2s"
  _hover={isClickable ? { transform: 'translateY(-8px)', shadow: 'lg' } : {}}
  onClick={onClick}
>
  <Text fontSize="lg" fontWeight="bold">{card.rank}</Text>
  <Text fontSize="xl">{card.suitSymbol}</Text>
</Box>

// Face-down card (card back)
<Box
  w={CARD_WIDTH}
  h={CARD_HEIGHT}
  borderRadius="md"
  border="2px solid"
  borderColor={isSelected ? 'card.selected' : 'gray.600'}
  bg="card.back"
  bgGradient="linear(135deg, blue.700, blue.900)"
  cursor={isClickable ? 'pointer' : 'default'}
  display="flex"
  alignItems="center"
  justifyContent="center"
>
  {/* Decorative pattern or logo */}
</Box>
```

### Slot Labels

Always show slot labels below cards:

```tsx
<VStack spacing={1}>
  <Card card={card} faceUp={faceUp} />
  <Badge
    colorScheme={isSelected ? 'yellow' : 'gray'}
    fontSize="xs"
  >
    {slot}
  </Badge>
</VStack>
```

---

## Game Board Layout

### Desktop Layout

```
+------------------------------------------+
|              Score Panel                  |
+------------------------------------------+
|    Opponent 1  |  Opponent 2  |  Opp 3   |
+------------------------------------------+
|                                          |
|     Draw Pile      Discard Pile          |
|                                          |
+------------------------------------------+
|           Your Hand (A B C D)            |
|          Action Buttons Panel            |
+------------------------------------------+
```

### Mobile Layout

```
+--------------------+
|    Score Panel     |
+--------------------+
| Opp 1 | Opp 2 | 3 |
+--------------------+
|  Draw  | Discard  |
+--------------------+
| Your Hand (A B C D)|
+--------------------+
|  Action Buttons    |
+--------------------+
```

### Game Board Component Structure

```tsx
<GameLayout>
  <ScorePanel scores={scores} currentRound={round} />
  
  <Grid templateRows="auto 1fr auto" h="full">
    {/* Top: Opponents */}
    <Flex wrap="wrap" justify="center" gap={4}>
      {opponents.map(opp => (
        <OpponentDisplay key={opp.id} player={opp} />
      ))}
    </Flex>
    
    {/* Center: Piles */}
    <Flex justify="center" align="center" gap={8}>
      <DrawPile count={deckCount} onDraw={handleDraw} />
      <DiscardPile cards={discardPile} onTake={handleTake} />
    </Flex>
    
    {/* Bottom: Your hand + actions */}
    <VStack spacing={4}>
      <PlayerHand cards={myCards} onSelect={handleSelect} />
      <ActionButtons
        onDraw={handleDraw}
        onTake={handleTake}
        onBurn={handleBurn}
        onCheck={handleCheck}
        isMyTurn={isMyTurn}
        canCheck={canCheck}
      />
    </VStack>
  </Grid>
</GameLayout>
```

---

## Modal Patterns

Use Chakra's Modal component consistently for all game modals:

```tsx
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';

export const RedJackModal: FC<RedJackModalProps> = ({
  isOpen,
  onClose,
  opponents,
  mySlots,
  onSwap,
  onSkip,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}         // Closing = skipping for game modals
      isCentered
      closeOnOverlayClick={false}  // Prevent accidental close during game
      size={{ base: 'sm', md: 'md' }}
    >
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Red Jack - Swap Cards</ModalHeader>
        <ModalBody>
          {/* Swap selection UI */}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button colorScheme="red" onClick={onSkip}>
            Skip Swap
          </Button>
          <Button colorScheme="green" onClick={handleSwap}>
            Swap Cards
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

### Modal Rules for Game

- `closeOnOverlayClick={false}` - Prevent accidental closes during gameplay
- `closeOnEsc={false}` for required-action modals (special effects)
- Always provide a "Skip" or "Cancel" action where the rules allow it
- Use `isCentered` for consistent positioning
- Modals should be responsive with `size={{ base: 'sm', md: 'md' }}`

---

## Toast Notifications

Use Chakra's toast for game events and errors:

```tsx
import { useToast } from '@chakra-ui/react';

const toast = useToast();

// Game event notification
toast({
  title: 'Player 2 called CHECK!',
  description: 'Final round - one more turn each.',
  status: 'warning',
  duration: 4000,
  isClosable: true,
  position: 'top',
});

// Error notification
toast({
  title: 'Invalid Action',
  description: 'It is not your turn.',
  status: 'error',
  duration: 3000,
  isClosable: true,
  position: 'top',
});

// Success notification
toast({
  title: 'Burn Successful!',
  description: 'Card removed from your hand.',
  status: 'success',
  duration: 2000,
  isClosable: true,
  position: 'top',
});
```

### Toast Convention for Game Events

| Event | Status | Duration |
|-------|--------|----------|
| Check called | `warning` | 4000ms |
| Your turn | `info` | 2000ms |
| Burn success | `success` | 2000ms |
| Burn failed (penalty) | `error` | 3000ms |
| Special effect used | `info` | 3000ms |
| Player joined/left | `info` | 2000ms |
| Validation error | `error` | 3000ms |
| Round ended | `info` | 5000ms |

---

## Button Patterns

### Action Buttons

```tsx
// Primary game action
<Button
  colorScheme="green"
  size={{ base: 'sm', md: 'md' }}
  isDisabled={!isMyTurn}
  onClick={onAction}
  leftIcon={<IconComponent />}
>
  Draw from Deck
</Button>

// Destructive/important action (Check)
<Button
  colorScheme="red"
  size={{ base: 'sm', md: 'lg' }}
  variant="solid"
  isDisabled={!canCheck}
  onClick={onCheck}
  fontWeight="bold"
>
  CALL CHECK
</Button>

// Secondary action
<Button
  variant="outline"
  colorScheme="gray"
  size="sm"
  onClick={onSecondary}
>
  Leave Room
</Button>
```

### Disabled State Convention

- When not your turn: all action buttons disabled with reduced opacity
- Tooltip on disabled buttons explaining why (e.g., "Wait for your turn")
- Check button disabled if check already called (tooltip: "Check already called")

```tsx
<Tooltip
  label={!isMyTurn ? 'Wait for your turn' : ''}
  isDisabled={isMyTurn}
>
  <Button isDisabled={!isMyTurn}>Draw</Button>
</Tooltip>
```

---

## Animation Guidelines

### Card Hover

```tsx
_hover={{
  transform: 'translateY(-8px)',
  shadow: 'xl',
  borderColor: 'card.selected',
}}
transition="all 0.2s ease-in-out"
```

### Card Selection

```tsx
// Selected card lifts up and glows
transform={isSelected ? 'translateY(-12px)' : 'none'}
shadow={isSelected ? '0 0 12px rgba(255, 214, 0, 0.5)' : 'none'}
borderColor={isSelected ? 'card.selected' : 'gray.600'}
```

### Initial Peek Animation

For the 3-second card reveal at game start, use CSS transitions or Framer Motion:

```tsx
// Simple CSS approach
<Box
  transform={isPeeking ? 'rotateY(180deg)' : 'rotateY(0deg)'}
  transition="transform 0.6s ease-in-out"
  style={{ transformStyle: 'preserve-3d' }}
>
```

### Keep Animations Subtle

- Card movements: 0.2-0.3s ease-in-out
- Modal transitions: use Chakra defaults
- Avoid excessive animations that slow down gameplay
- All animations should be performant (use transform/opacity, avoid layout shifts)

---

## Responsive Breakpoints

Use Chakra's default breakpoints consistently:

| Breakpoint | Min Width | Target |
|------------|-----------|--------|
| `base` | 0px | Small phones |
| `sm` | 480px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 992px | Small desktops |
| `xl` | 1280px | Large desktops |

### Key Responsive Decisions

- **Cards**: Scale from 60px to 100px width across breakpoints
- **Game board**: Single column on mobile, 3-column grid on desktop
- **Opponents**: Horizontal scroll on mobile, grid on desktop
- **Action buttons**: Stack vertically on mobile, horizontal on desktop
- **Modals**: Full-width on mobile (`size="full"`), centered medium on desktop
- **Font sizes**: Scale up with breakpoints for readability

---

## Accessibility

- Use semantic HTML elements via Chakra (Button, Heading, etc.)
- All interactive elements must be keyboard accessible
- Card suit symbols should have aria-labels (e.g., `aria-label="7 of hearts"`)
- Color is never the only indicator - always pair with text/icons
- Toast notifications use appropriate `status` for screen readers
- Modals trap focus correctly (Chakra handles this automatically)
- Sufficient color contrast (especially red vs black card text on white background)
