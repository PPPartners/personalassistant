import React from 'react';

/**
 * Reusable Button component with consistent styling for dark theme
 *
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'icon'} props.variant - Button style variant
 * @param {'sm' | 'md' | 'lg'} props.size - Button size
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Click handler
 * @param {string} props.title - Tooltip text
 * @param {string} props.type - Button type (button, submit, reset)
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  className = '',
  onClick,
  title,
  type = 'button',
  ...rest
}) {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-sm hover:shadow-md',
    secondary: 'bg-dark-elevated text-text-primary border border-dark-border hover:bg-dark-hover hover:border-primary-500/30 shadow-sm',
    success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 shadow-sm hover:shadow-md',
    danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-sm hover:shadow-md',
    ghost: 'bg-transparent text-text-secondary hover:bg-dark-elevated hover:text-text-primary border border-transparent hover:border-dark-border',
    icon: 'aspect-square p-2 bg-dark-elevated text-text-primary hover:bg-dark-hover hover:border-primary-500/30 border border-dark-border rounded-lg shadow-sm'
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.primary}
    ${size !== 'icon' ? sizeClasses[size] : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
