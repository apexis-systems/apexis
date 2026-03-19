import React from 'react';
import {
    Text as RNText,
    TextInput as RNTextInput,
    TextProps as RNTextProps,
    TextInputProps as RNTextInputProps
} from 'react-native';

export const Text = React.forwardRef<RNText, RNTextProps & { className?: string }>((props, ref) => {
    const { style, className, ...rest } = props;

    // Preserve Angelica brand font explicitly if classed
    if (className?.includes('font-angelica')) {
        return <RNText ref={ref} className={className} style={style} {...rest} />;
    }

    // Force strict Montserrat-Regular and erase fontWeight to prevent Android font engine crash
    const customStyle = [{ fontFamily: 'Montserrat' }, style, { fontWeight: undefined }];

    return <RNText ref={ref} className={className} style={customStyle} {...rest} />;
});
Text.displayName = 'Text';

export const TextInput = React.forwardRef<RNTextInput, RNTextInputProps & { className?: string }>((props, ref) => {
    const { style, className, ...rest } = props;

    // Preserve Angelica brand font explicitly if classed
    if (className?.includes('font-angelica')) {
        return <RNTextInput ref={ref} className={className} style={style} {...rest} />;
    }

    // Force strict Montserrat-Regular and erase fontWeight to prevent Android font engine crash
    const customStyle = [{ fontFamily: 'Montserrat' }, style, { fontWeight: undefined }];

    return <RNTextInput ref={ref} className={className} style={customStyle} {...rest} />;
});
TextInput.displayName = 'TextInput';
