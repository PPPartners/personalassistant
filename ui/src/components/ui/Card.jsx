import React from 'react';

/**
 * Reusable Card component with glassmorphic design for dark theme
 *
 * @param {Object} props
 * @param {'default' | 'elevated' | 'interactive'} props.variant - Card style variant
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Click handler (makes card interactive)
 * @param {Object} props.style - Inline styles
 */
function Card({
  variant = 'default',
  children,
  className = '',
  onClick,
  style,
  ...rest
}) {
  const baseClasses = 'rounded-lg transition-all duration-200';

  const variantClasses = {
    default: 'bg-dark-elevated backdrop-blur-sm border border-dark-border shadow-glass-sm',
    elevated: 'bg-dark-elevated backdrop-blur-md border-2 border-dark-border shadow-glass',
    interactive: 'bg-dark-elevated backdrop-blur-sm border border-dark-border shadow-glass-sm cursor-pointer hover:bg-dark-hover hover:border-primary-500/30 hover:shadow-glass active:scale-[0.98]'
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.default}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
