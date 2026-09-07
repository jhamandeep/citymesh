'use client';
import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
export default function FullscreenButton({
  target,
  label = 'app',
}: {
  target?: string;
  label?: string;
}) {
  const button = useRef<HTMLButtonElement>(null),
    element = useRef<HTMLElement | null>(null),
    fallback = useRef(false),
    [active, setActive] = useState(false),
    [message, setMessage] = useState('');
  const clear = () => {
    if (fallback.current) {
      element.current?.classList.remove('expanded-view');
      document.documentElement.classList.remove('expanded-workspace');
      document.body.classList.remove('has-expanded-view');
      fallback.current = false;
    }
    setActive(false);
    setMessage('');
  };
  useEffect(() => {
    const changed = () => {
      setActive(
        (document.fullscreenElement === element.current && !!element.current) ||
          fallback.current,
      );
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fallback.current) {
        clear();
        button.current?.focus();
      }
    };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('keydown', key);
      if (fallback.current) {
        element.current?.classList.remove('expanded-view');
        document.documentElement.classList.remove('expanded-workspace');
        document.body.classList.remove('has-expanded-view');
      }
    };
  }, []);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="fullscreen-button"
        aria-label={`${active ? 'Exit' : 'Enter'} ${label} fullscreen`}
        aria-pressed={active}
        title={active ? 'Exit fullscreen · Esc' : 'Expand workspace'}
        onClick={async () => {
          setMessage('');
          if (active) {
            if (fallback.current) clear();
            else if (document.fullscreenElement) {
              try {
                await document.exitFullscreen();
              } catch {
                setMessage('Use Esc to exit fullscreen.');
              }
            }
            button.current?.focus();
            return;
          }
          const next = target
            ? button.current?.closest<HTMLElement>(target)
            : document.documentElement;
          if (!next) {
            setMessage('This view cannot be expanded.');
            return;
          }
          element.current = next;
          try {
            if (!next.requestFullscreen) throw new Error('Unavailable');
            await next.requestFullscreen();
            setActive(true);
          } catch {
            fallback.current = true;
            if (target) {
              next.classList.add('expanded-view');
              document.body.classList.add('has-expanded-view');
            } else document.documentElement.classList.add('expanded-workspace');
            setActive(true);
            setMessage('Expanded view active. Press Esc to exit.');
          }
        }}
      >
        {active ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        <span>{active ? 'Exit fullscreen' : 'Fullscreen'}</span>
      </button>
      {message && <output className="fullscreen-feedback">{message}</output>}
    </>
  );
}
