import React from 'react';

/**
 * Reusable Badge component for tags, priorities, and status indicators
 *
 * @param {Object} props
 * @param {'priority-high' | 'priority-medium' | 'priority-low' | 'priority-none' | 'urgency-overdue' | 'urgency-critical' | 'urgency-soon' | 'urgency-upcoming' | 'urgency-normal' | 'status-open' | 'status-in-progress' | 'status-completed' | 'neutral' | 'info'} props.variant - Badge style variant
 * @param {'sm' | 'md' | 'lg'} props.size - Badge size
 * @param {React.ReactNode} props.children - Badge content
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.icon - Optional emoji or icon
 */
function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
  icon,
  ...rest
}) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full font-medium transition-colors';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const variantClasses = {
    // Priority badges
    'priority-high': 'bg-danger-500/20 text-danger-400 border border-danger-500/30',
    'priority-medium': 'bg-warning-500/20 text-warning-400 border border-warning-500/30',
    'priority-low': 'bg-success-500/20 text-success-400 border border-success-500/30',
    'priority-none': 'bg-dark-elevated text-text-tertiary border border-dark-border',

    // Urgency badges
    'urgency-overdue': 'bg-danger-500/30 text-danger-300 border border-danger-500/50 font-bold',
    'urgency-critical': 'bg-danger-500/20 text-danger-400 border border-danger-500/40',
    'urgency-soon': 'bg-warning-500/20 text-warning-400 border border-warning-500/40',
    'urgency-upcoming': 'bg-primary-500/20 text-primary-400 border border-primary-500/40',
    'urgency-normal': 'bg-dark-elevated text-text-secondary border border-dark-border',

    // Status badges
    'status-open': 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
    'status-in-progress': 'bg-focus-500/20 text-focus-400 border border-focus-500/30',
    'status-completed': 'bg-success-500/20 text-success-400 border border-success-500/30',

    // Generic badges
    'neutral': 'bg-dark-elevated text-text-secondary border border-dark-border',
    'info': 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
  };

  const classes = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant] || variantClasses.neutral}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <span className={classes} {...rest}>
      {icon && <span className="text-sm">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
