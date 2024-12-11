import React from 'react';
import './Button.scss';

import { Icon } from 'react-feather';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: Icon;
  iconPosition?: 'start' | 'end' | 'center';
  iconColor?: 'red' | 'green' | 'grey';
  iconFill?: boolean;
  buttonStyle?: 'regular' | 'action' | 'alert' | 'flush';
}

export function Button({
  label = 'Okay',
  icon = void 0,
  iconPosition = 'start',
  iconColor = void 0,
  iconFill = false,
  buttonStyle = 'regular',
  ...rest
}: ButtonProps) {
  const StartIcon = iconPosition === 'start' ? icon : null;
  const EndIcon = iconPosition === 'end' ? icon : null;
  const classList = [];
  if (iconColor) {
    classList.push(`icon-${iconColor}`);
  }
  if (iconFill) {
    classList.push(`icon-fill`);
  }
  classList.push(`button-style-${buttonStyle}`);

  return (
    <button data-component="Button" className={classList.join(' ')} {...rest}>
      {StartIcon && (
        <span className="icon">
          <StartIcon />
        </span>
      )}
      <span className="label" hidden>{label}</span>
      {EndIcon && (
        <span className="icon">
          <EndIcon />
        </span>
      )}
    </button>
  );
}
