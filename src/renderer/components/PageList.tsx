import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PageRenderer } from './PageRenderer';
import { useDocumentStore } from '../stores/documentStore';

interface PageListProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pendingSignatureDataUrl?: string | null;
  onSignaturePlaced?: () => void;
}

export const PageList: React.FC<PageListProps> = ({ containerRef, pendingSignatureDataUrl, onSignaturePlaced }) => {
  const { documentInfo, setCurrentPage } = useDocumentStore();
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([0]));
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Set up IntersectionObserver for lazy rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !documentInfo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-wrapper') ?? '-1');
            if (pageNum < 0) continue;
            if (entry.isIntersecting) {
              next.add(pageNum);
            } else {
              next.delete(pageNum);
            }
          }
          return next;
        });
      },
      {
        root: container,
        rootMargin: '200px 0px', // Pre-render pages 200px before they enter viewport
        threshold: 0,
      }
    );

    // Observe all page wrappers
    pageRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [containerRef, documentInfo]);

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      let closestPage = 0;
      let closestDist = Infinity;

      pageRefs.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        const pageCenterY = rect.top + rect.height / 2;
        const dist = Math.abs(pageCenterY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = pageNum;
        }
      });

      setCurrentPage(closestPage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, setCurrentPage]);

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  if (!documentInfo) return null;

  return (
    <div style={{ padding: '10px 0 40px' }}>
      {Array.from({ length: documentInfo.pageCount }, (_, i) => (
        <div
          key={i}
          ref={(el) => setPageRef(i, el)}
          data-page-wrapper={i}
          style={{ padding: '10px 20px' }}
        >
          <PageRenderer pageNum={i} isVisible={visiblePages.has(i)} pendingSignatureDataUrl={pendingSignatureDataUrl} onSignaturePlaced={onSignaturePlaced} />
        </div>
      ))}
    </div>
  );
};
