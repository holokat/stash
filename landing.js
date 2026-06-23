(() => {
  const root = document.querySelector('.lkroot');
  if (!root) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = !prefersReducedMotion;

  function applyTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    root.classList.add('lk-no-trans');
    root.dataset.theme = nextTheme;
    document.body.classList.toggle('lk-light', nextTheme === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'light' ? '#FBF8F3' : '#0B0B0D');
    void root.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('lk-no-trans'));
    });
  }

  let theme = 'dark';
  try {
    theme = localStorage.getItem('stash-theme') || 'dark';
  } catch {
    theme = 'dark';
  }

  applyTheme(theme);

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('stash-theme', theme);
    } catch {
      // Theme still applies for the current session.
    }
    applyTheme(theme);
  });

  for (const host of document.querySelectorAll('.lkwheelBtn')) {
    host.addEventListener('click', () => {
      if (!canAnimate) return;
      const wheel = host.querySelector('svg');
      if (!wheel?.animate) return;
      wheel.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: 850,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    });
  }

  for (const button of document.querySelectorAll('.lkspark')) {
    button.addEventListener('mouseenter', () => ctaSpark(button));
  }

  const gem = document.querySelector('.lkgem');
  if (gem) {
    const original = gem.textContent;
    gem.addEventListener('mouseenter', () => {
      gem.textContent = 'you found the hidden stash ◆';
    });
    gem.addEventListener('mouseleave', () => {
      gem.textContent = original;
    });
  }

  if (!canAnimate) {
    for (const reveal of document.querySelectorAll('[data-reveal]')) {
      reveal.classList.add('is-visible');
    }
    return;
  }

  const runHero = () => {
    for (const element of document.querySelectorAll('[data-hero]')) {
      if (element.dataset.heroDone || !element.animate) continue;
      element.dataset.heroDone = 'true';
      const delay = Number.parseInt(element.dataset.hd || '0', 10);
      window.setTimeout(() => {
        element.animate(
          [
            { opacity: 0, transform: 'translateY(28px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 820, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      }, Number.isFinite(delay) ? delay : 0);
    }
  };

  if (document.visibilityState === 'visible') {
    runHero();
  } else {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      runHero();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    document.addEventListener('visibilitychange', onVisibility);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target;
          const delay = Number.parseInt(element.dataset.revealDelay || '0', 10);
          element.style.transitionDelay = `${Number.isFinite(delay) ? delay : 0}ms`;
          element.classList.add('is-visible');
          observer.unobserve(element);
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );

    for (const reveal of document.querySelectorAll('[data-reveal]')) {
      observer.observe(reveal);
    }
  } else {
    for (const reveal of document.querySelectorAll('[data-reveal]')) {
      reveal.classList.add('is-visible');
    }
  }

  window.setTimeout(() => {
    for (const reveal of document.querySelectorAll('[data-reveal]:not(.is-visible)')) {
      reveal.style.transition = 'none';
      reveal.classList.add('is-visible');
    }
  }, 2600);

  const parallaxTargets = [...document.querySelectorAll('[data-par]')];
  if (parallaxTargets.length) {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      for (const element of parallaxTargets) {
        const factor = Number.parseFloat(element.dataset.par || '0');
        element.style.transform = `translate3d(0, ${(scrollY * factor).toFixed(1)}px, 0)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function ctaSpark(button) {
    if (!canAnimate) return;
    const colors = ['#FF9D5C', '#F2742B', '#FFD9BC', '#FFC79A'];
    for (let index = 0; index < 10; index += 1) {
      const dot = document.createElement('span');
      const size = 4 + Math.random() * 4;
      const color = colors[index % colors.length];
      dot.className = 'spark-dot';
      dot.style.left = `${15 + Math.random() * 70}%`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.background = color;
      dot.style.boxShadow = `0 0 8px ${color}`;
      button.append(dot);

      const dx = (Math.random() - 0.5) * 80;
      const dy = -20 - Math.random() * 46;
      const animation = dot.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 },
        ],
        { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }
      );
      animation.onfinish = () => dot.remove();
    }
  }
})();
