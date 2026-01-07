import { ButtonHTMLAttributes, ReactNode } from 'react'

// 统一圆角配置
export const RADIUS = {
  sm: 'rounded-lg',      // 8px - 小元素如按钮、输入框
  md: 'rounded-xl',      // 12px - 卡片、模态框
  lg: 'rounded-2xl',     // 16px - 大卡片、容器
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  children: ReactNode
}

/**
 * 统一按钮组件
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = `font-medium transition-all ${RADIUS.sm} disabled:opacity-50 flex items-center justify-center gap-2`
  
  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
    secondary: 'border border-border-main text-text-main hover:bg-hover-bg',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'text-text-secondary hover:text-text-main hover:bg-hover-bg',
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

// 图标按钮
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'success' | 'warning'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function IconButton({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: IconButtonProps) {
  const baseStyles = `${RADIUS.sm} transition-all flex items-center justify-center`
  
  const variantStyles = {
    default: 'text-text-secondary hover:text-text-main hover:bg-hover-bg',
    danger: 'text-red-500 hover:bg-red-50',
    success: 'text-green-600 hover:bg-green-50',
    warning: 'text-amber-500 hover:bg-amber-50',
  }
  
  const sizeStyles = {
    sm: 'p-1',
    md: 'p-1.5',
  }
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// 卡片容器
interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }
  
  return (
    <div className={`bg-bg-card border border-border-main ${RADIUS.lg} shadow-sm ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  )
}

// 输入框
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && <label className="block text-sm text-text-secondary mb-1.5">{label}</label>}
      <input
        className={`w-full px-3 py-2.5 text-sm border border-border-main ${RADIUS.sm} bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all ${className}`}
        {...props}
      />
    </div>
  )
}

// 文本域
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label && <label className="block text-sm text-text-secondary mb-1.5">{label}</label>}
      <textarea
        className={`w-full px-3 py-2.5 text-sm border border-border-main ${RADIUS.md} bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none ${className}`}
        {...props}
      />
    </div>
  )
}

// 空状态
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="text-center py-12">
      <div className="text-text-secondary/50 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-lg font-medium text-text-main mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary mb-6">{description}</p>}
      {action}
    </Card>
  )
}

// 页面标题栏
interface PageHeaderProps {
  title: string
  count?: number
  action?: ReactNode
  backButton?: ReactNode
}

export function PageHeader({ title, count, action, backButton }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6 px-1">
      <h2 className="text-lg font-semibold text-text-main min-w-0">
        {backButton || (
          <>
            {title}
            {count !== undefined && ` (${count})`}
          </>
        )}
      </h2>
      {action}
    </div>
  )
}
