import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, ui } from '@/theme/colors';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({ containerStyle, editable = true, onChangeText, value, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const handleChangeText = (nextValue: string) => {
    if (!nextValue) setVisible(false);
    onChangeText?.(nextValue);
  };

  return (
    <View style={[styles.container, !editable && styles.disabled, containerStyle]}>
      <TextInput
        {...props}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        editable={editable}
        placeholderTextColor={props.placeholderTextColor ?? colors.textPlaceholder}
        secureTextEntry={!visible}
        value={value}
        onChangeText={handleChangeText}
        style={[styles.input, props.style]}
      />
      <Pressable
        accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        accessibilityRole="button"
        disabled={!editable}
        hitSlop={4}
        onPress={() => setVisible(current => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Text style={styles.toggleText}>{visible ? 'Ẩn' : 'Hiện'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: ui.controlHeight,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabled: { backgroundColor: colors.surfaceMuted, opacity: 0.72 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: ui.controlHeight - 2,
    paddingLeft: 12,
    paddingRight: 6,
    color: colors.text,
    fontSize: 14,
  },
  toggle: {
    minHeight: ui.controlHeight - 2,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePressed: { opacity: 0.62 },
  toggleText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
});
