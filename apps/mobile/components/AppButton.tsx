import Bounceable from './Bounceable';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  active?: boolean;
  fontSize?: number;
  accent?: boolean;
};

export default function AppButton({ label, onPress, active = false, fontSize = 16, accent = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, (pressed || active) && styles.btnActive]}
    >
      {({ pressed }) => (
        <Bounceable>

          <Text
          style={[
            styles.label,
            { fontSize },
            active && styles.labelActive,
            !active && pressed && styles.labelPressed,
            accent && styles.labelAccent,
          ]}
        >
          _{label}
        </Text>

        </Bounceable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
    borderRadius: 8,
  },
  btnActive: {
    backgroundColor: '#fff',
  },
  label: {
    color: '#fff',
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelActive: {
    color: '#000',
  },
  labelPressed: {
    color: '#C0C0C0',
  },
  labelAccent: {
    color: '#ff2bd6',
    fontWeight: 'bold',
  },
});
