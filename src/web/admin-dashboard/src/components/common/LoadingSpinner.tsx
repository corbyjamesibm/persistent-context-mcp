import React from 'react';
import { Loading } from '@carbon/react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  withOverlay?: boolean;
  description?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  withOverlay = false,
  description = 'Loading...',
  className = '',
}) => {
  const getSizeProps = () => {
    switch (size) {
      case 'sm':
        return { small: true };
      case 'lg':
        return { large: true };
      default:
        return {};
    }
  };

  const spinner = (
    <Loading
      description={description}
      withOverlay={withOverlay}
      className={className}
      {...getSizeProps()}
    />
  );

  if (withOverlay) {
    return (
      <div className="loading-overlay">
        {spinner}
        <style jsx>{`
          .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.8);
            z-index: 9999;
          }
        `}</style>
      </div>
    );
  }

  return spinner;
};