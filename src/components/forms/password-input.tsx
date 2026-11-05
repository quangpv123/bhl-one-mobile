import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';

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
    <View
      className={`h-control flex-row items-center rounded-control border border-border bg-surface ${!editable ? 'bg-surface-muted opacity-70' : ''}`}
      style={containerStyle}
    >
      <TextInput
        {...props}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        editable={editable}
        placeholderTextColor={props.placeholderTextColor ?? colors.textPlaceholder}
        secureTextEntry={!visible}
        value={value}
        onChangeText={handleChangeText}
        className="h-8 flex-1 min-w-0 py-0 pl-3 pr-1.5 text-sm text-content"
        style={props.style}
      />
      <Pressable
        accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        accessibilityRole="button"
        disabled={!editable}
        hitSlop={4}
        onPress={() => setVisible(current => !current)}
        className="h-8 items-center justify-center px-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.62 : 1 })}
      >
        <Text className="text-label font-semibold text-primary-dark">{visible ? 'Ẩn' : 'Hiện'}</Text>
      </Pressable>
    </View>
  );
}
