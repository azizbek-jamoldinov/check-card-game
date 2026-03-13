import { FC } from 'react';
import { Box, Text } from '@chakra-ui/react';

// ============================================================
// Types
// ============================================================

export interface CardBackProps {
  isSelected?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================
// Dimensions per size
// ============================================================

const SIZES = {
  sm: { w: '52px', h: '74px', label: 'xs', pattern: '6px' },
  md: { w: '80px', h: '112px', label: 'sm', pattern: '8px' },
  lg: { w: '100px', h: '140px', label: 'md', pattern: '10px' },
};

// ============================================================
// CardBack Component
// ============================================================

export const CardBack: FC<CardBackProps> = ({
  isSelected = false,
  isClickable = false,
  onClick,
  size = 'md',
}) => {
  const s = SIZES[size];

  return (
    <Box
      w={s.w}
      h={s.h}
      borderRadius="md"
      border="2px solid"
      borderColor={isSelected ? 'card.selected' : 'gray.500'}
      bg="card.back"
      cursor={isClickable || onClick ? 'pointer' : 'default'}
      onClick={onClick}
      transition="all 0.2s ease-in-out"
      shadow={isSelected ? '0 0 12px rgba(255, 214, 0, 0.5)' : 'sm'}
      _hover={isClickable || onClick ? { transform: 'translateY(-4px)', shadow: 'lg' } : {}}
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
      userSelect="none"
    >
      {/* Inner border pattern */}
      <Box
        position="absolute"
        inset="4px"
        borderRadius="sm"
        border="1px solid"
        borderColor="blue.400"
        opacity={0.3}
      />

      {/* Diamond pattern in the center */}
      <Box
        position="absolute"
        inset="8px"
        borderRadius="sm"
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="center"
        gap="2px"
        overflow="hidden"
        opacity={0.15}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <Text key={i} fontSize={s.pattern} color="white" lineHeight={1}>
            {'\u2666'}
          </Text>
        ))}
      </Box>

      {/* Center label */}
      <Text
        fontSize={s.label}
        fontWeight="bold"
        color="blue.200"
        opacity={0.6}
        letterSpacing="wider"
        textTransform="uppercase"
        zIndex={1}
      >
        CHECK
      </Text>
    </Box>
  );
};
