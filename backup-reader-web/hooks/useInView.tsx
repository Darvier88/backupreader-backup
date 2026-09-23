import { useState, useEffect, RefObject } from 'react';

const useInView = (ref: RefObject<HTMLElement>, rootMargin: string = '0px'): boolean => {
  // State and setter for storing whether element is visible
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, rootMargin]);

  return isInView;
};

export default useInView;