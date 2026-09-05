export interface TextCustomization {
  startIndex: number;
  endIndex?: number;
  fontSize?: number;
  fontColor?: string;
  bold?: boolean;
  includeCopyBtn?: boolean;
}

export class Notification {
  private container: HTMLElement | null = null;
  private notifications: Map<string, HTMLElement> = new Map();
  private defaultLifetime = 5000;

  private createContainer() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(this.container);
  }

  private getPositionStyle(position: string): string {
    const positions: Record<string, string> = {
      'top-left': 'top: 20px; left: 20px; transform: none;',
      'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 20px; right: 20px; transform: none;',
      'center-left': 'top: 50%; left: 20px; transform: translateY(-50%);',
      'center-center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 20px; transform: translateY(-50%);',
      'bottom-left': 'bottom: 20px; left: 20px; transform: none;',
      'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 20px; right: 20px; transform: none;',
    };
    return positions[position] || positions['center-center'];
  }

  private applyCustomization(
    text: string,
    customization?: TextCustomization,
  ): {
    prefix: string;
    customText: string;
    suffix: string;
    plainCustomText: string;
    hasCopyBtn: boolean;
  } {
    if (!customization) {
      return {
        prefix: text,
        customText: '',
        suffix: '',
        plainCustomText: '',
        hasCopyBtn: false,
      };
    }

    const start = customization.startIndex ?? 0;
    const end = customization.endIndex ?? text.length;

    const safeStart = Math.max(0, Math.min(start, text.length));
    const safeEnd = Math.max(safeStart, Math.min(end, text.length));

    const prefix = text.substring(0, safeStart);
    const customText = text.substring(safeStart, safeEnd);
    const suffix = text.substring(safeEnd);

    return {
      prefix,
      customText,
      suffix,
      plainCustomText: customText,
      hasCopyBtn: customization.includeCopyBtn ?? false,
    };
  }

  private createCopyButton(
    plainText: string,
    id: any = null,
    resolveFunction: Function | any = null,
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = '⎘';
    btn.style.cssText = `
      background: transparent;
      border: 1px solid rgba(71,254,15,0.3);
      border-radius: 6px;
      color: #67fe0f;
      cursor: pointer;
      padding: 4px 10px;
      font-size: 18px;
      transition: all 0.2s ease;
      flex-shrink: 0;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#47fe0f';
      btn.style.background = 'rgba(71,254,15,0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(71,254,15,0.3)';
      btn.style.background = 'transparent';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(plainText)
        .then(() => {
          const originalText = btn.textContent;
          btn.textContent = '✓';
          btn.style.borderColor = '#28e717';
          btn.style.color = '#28e717';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.borderColor = 'rgba(71,254,15,0.3)';
            btn.style.color = '#67fe0f';
          }, 1500);
          // ✅ Закрываем уведомление после копирования
          if (this.notifications.has(id)) {
            this.destroyNotification(id);
            resolveFunction && resolveFunction();
          }
        })
        .catch(() => {
          const textarea = document.createElement('textarea');
          textarea.value = plainText;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
          const originalText = btn.textContent;
          btn.textContent = '✓';
          btn.style.borderColor = '#28e717';
          btn.style.color = '#28e717';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.borderColor = 'rgba(71,254,15,0.3)';
            btn.style.color = '#67fe0f';
          }, 1500);
          if (this.notifications.has(id)) {
            this.destroyNotification(id);
            resolveFunction && resolveFunction();
          }
        });
    });

    return btn;
  }

  private createNotification(
    text: string,
    position: string = 'center-center',
    lifetime: number = this.defaultLifetime,
    customization: TextCustomization | any = null,
    countdown: number = 0,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.createContainer();

      const id =
        Date.now().toString() + Math.random().toString(36).substr(2, 6);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        transform-origin: center center;
        transform: scaleX(0);
        transition: transform 0.4s cubic-bezier(0.34, 1.3, 0.55, 1);
      `;

      const notification = document.createElement('div');
      notification.style.cssText = `
        background: rgba(0,0,0,0.95);
        border: 2px solid #47fe0f;
        border-radius: 12px;
        padding: 20px 32px;
        min-width: 400px;
        max-width: 420px;
        text-align: center;
        color: #67fe0f;
        font-family: 'Courier New', Courier, monospace;
        font-size: 18px;
        box-shadow: 0 0 20px rgba(71,254,15,0.2);
        pointer-events: auto;
        backdrop-filter: blur(4px);
        cursor: pointer;
        position: relative;
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: 1.6;
      `;

      const { prefix, customText, suffix, plainCustomText, hasCopyBtn } =
        this.applyCustomization(text, customization);

      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: 100%;
      `;

      if (prefix) {
        const prefixEl = document.createElement('div');
        prefixEl.style.cssText = `
          white-space: pre-wrap;
          word-break: break-word;
        `;
        prefixEl.textContent = prefix;
        contentWrapper.appendChild(prefixEl);
      }

      if (customText) {
        const row = document.createElement('div');
        row.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        `;

        const customTextEl = document.createElement('span');
        const fontSize = customization?.fontSize ?? 18;
        const fontColor = customization?.fontColor ?? '#67fe0f';
        const bold = customization?.bold ?? false;
        customTextEl.style.cssText = `
          font-size: ${fontSize}px;
          color: ${fontColor};
          ${bold ? 'font-weight: bold;' : ''}
          white-space: pre-wrap;
          word-break: break-word;
        `;
        customTextEl.textContent = customText;
        row.appendChild(customTextEl);

        if (hasCopyBtn) {
          const copyBtn = this.createCopyButton(plainCustomText, id, resolve);
          row.appendChild(copyBtn);
        }

        contentWrapper.appendChild(row);
      }

      if (suffix) {
        const suffixEl = document.createElement('div');
        suffixEl.style.cssText = `
          white-space: pre-wrap;
          word-break: break-word;
        `;
        suffixEl.textContent = suffix;
        contentWrapper.appendChild(suffixEl);
      }

      notification.appendChild(contentWrapper);

      let countdownInterval: ReturnType<typeof setInterval> | null = null;
      let countdownEl: HTMLElement | null = null;

      if (countdown > 0) {
        (wrapper as any).__countdownInterval = countdownInterval;
        countdownEl = document.createElement('div');
        countdownEl.style.cssText = `
    margin-top: 8px;
    font-size: 22px;
    font-weight: bold;
    color: #47fe0f;
    letter-spacing: 1px;
    font-variant-numeric: tabular-nums;
  `;
        countdownEl.textContent = String(countdown);
        contentWrapper.appendChild(countdownEl);

        let remaining = countdown;

        countdownInterval = setInterval(() => {
          remaining -= 1;
          if (countdownEl) {
            countdownEl.textContent = String(Math.max(0, remaining));
          }
          if (remaining <= 0 && countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
        }, 1000);
      }

      if (lifetime > 0) {
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: #47fe0f;
          width: 100%;
          border-radius: 0 0 12px 12px;
          animation: shrinkWidth ${lifetime}ms linear forwards;
        `;
        notification.appendChild(progressBar);
      }

      notification.addEventListener('click', () => {
        if (this.notifications.has(id)) {
          this.destroyNotification(id);
          resolve();
        }
      });

      notification.addEventListener('mouseenter', () => {
        notification.style.borderColor = '#ff4d4d';
        notification.style.boxShadow = '0 0 30px rgba(255,77,77,0.3)';
      });

      notification.addEventListener('mouseleave', () => {
        notification.style.borderColor = '#47fe0f';
        notification.style.boxShadow = '0 0 20px rgba(71,254,15,0.2)';
      });

      wrapper.appendChild(notification);

      let positionContainer = this.container?.querySelector(
        `[data-position="${position}"]`,
      ) as HTMLElement;

      if (!positionContainer) {
        positionContainer = document.createElement('div');
        positionContainer.style.cssText = `
          position: absolute;
          display: flex;
          flex-direction: column;
          gap: 10px;
          ${this.getPositionStyle(position)}
        `;
        if (position.includes('top')) {
          positionContainer.style.flexDirection = 'column-reverse';
        }
        positionContainer.setAttribute('data-position', position);
        this.container?.appendChild(positionContainer);
      }

      positionContainer.appendChild(wrapper);
      this.notifications.set(id, wrapper);

      requestAnimationFrame(() => {
        wrapper.style.transform = 'scaleX(1)';
      });

      if (lifetime > 0) {
        setTimeout(() => {
          if (this.notifications.has(id)) {
            this.destroyNotification(id);
            resolve();
          }
        }, lifetime);
      }
    });
  }

  private destroyNotification(id: string) {
    const wrapper = this.notifications.get(id);
    if (!wrapper) return;

    const interval = (wrapper as any).__countdownInterval;
    if (interval) {
      clearInterval(interval);
      (wrapper as any).__countdownInterval = null;
    }

    wrapper.style.transform = 'scaleX(0)';

    setTimeout(() => {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      this.notifications.delete(id);

      const positionContainer = wrapper.parentNode as HTMLElement;
      if (positionContainer && positionContainer.children.length === 0) {
        if (positionContainer.parentNode) {
          positionContainer.parentNode.removeChild(positionContainer);
        }
      }
    }, 400);
  }

  public async show(
    text: string,
    position:
      | 'top-left'
      | 'top-center'
      | 'top-right'
      | 'center-left'
      | 'center-center'
      | 'center-right'
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right' = 'center-center',
    lifetime: number = this.defaultLifetime,
    customization?: TextCustomization,
    countdown: number = 0,
  ): Promise<void> {
    return this.createNotification(
      text,
      position,
      lifetime,
      customization,
      countdown,
    );
  }

  public destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
    this.notifications.clear();
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes shrinkWidth {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`;
document.head.appendChild(style);

export default new Notification();
