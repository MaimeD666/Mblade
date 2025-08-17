const WIDGET_TYPES = {
  MAIN: 'visualizer',
  SMALL: ['tracksPlayed', 'listeningTime', 'favoriteTrack', 'gifWidget']
};

const STORAGE_KEY = 'visible_widgets';

export const WidgetManager = {
  getInitialState() {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        // Визуализатор всегда включен
        state.visualizer = true;
        return state;
      }
    } catch (e) {
      console.error('Ошибка загрузки состояния виджетов:', e);
    }

    return {
      visualizer: true,
      tracksPlayed: true,
      listeningTime: true,
      favoriteTrack: true,
      gifWidget: true
    };
  },

  saveState(state) {
    const stateToSave = { ...state, visualizer: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  },

  toggleWidget(state, widgetId) {
    // Визуализатор нельзя отключить
    if (widgetId === 'visualizer') return state;

    const newState = {
      ...state,
      [widgetId]: !state[widgetId]
    };
    this.saveState(newState);
    return newState;
  },

  getGridClassName(state) {
    if (!state) return 'stats-widgets widgets-0';
    const visibleCount = WIDGET_TYPES.SMALL.filter(id => state[id]).length;
    return `stats-widgets widgets-${visibleCount}`;
  },

  getVisibleSmallCount(state) {
    if (!state) return 0;
    return WIDGET_TYPES.SMALL.filter(id => state[id]).length;
  },

  // Определяем оптимальную раскладку для виджетов
  getOptimalLayout(visibleCount) {
    switch (visibleCount) {
      case 0:
        return { columns: 0, rows: 0 };
      case 1:
        return { columns: 1, rows: 1 };
      case 2:
        return { columns: 2, rows: 1 };
      case 3:
        return { columns: 3, rows: 1 };
      case 4:
        return { columns: 4, rows: 1 }; // 4 виджета в одну строку
      default:
        return { columns: 4, rows: Math.ceil(visibleCount / 4) };
    }
  },

  getWidgetStyles(state) {
    if (!state) {
      return {
        mainWidgetStyle: {
          flex: '1',
          height: '100%',
          minHeight: '0'
        },
        smallWidgetsStyles: {}
      };
    }

    const visibleCount = this.getVisibleSmallCount(state);
    const mainWidgetStyle = {};
    const smallWidgetsStyles = {};

    // Визуализатор всегда занимает максимум доступного места
    mainWidgetStyle.flex = '1';
    mainWidgetStyle.height = '100%';
    mainWidgetStyle.minHeight = '0';
    mainWidgetStyle.maxHeight = 'none';

    // Стили для маленьких виджетов
    const baseWidgetStyle = {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '15px'
    };

    // Применяем стили к видимым виджетам
    WIDGET_TYPES.SMALL.forEach(widgetId => {
      if (state[widgetId]) {
        smallWidgetsStyles[widgetId] = { ...baseWidgetStyle };

        // Специальные стили для конкретных виджетов
        if (widgetId === 'gifWidget') {
          smallWidgetsStyles[widgetId].overflow = 'hidden';
          smallWidgetsStyles[widgetId].borderRadius = '25px';
          smallWidgetsStyles[widgetId].padding = '0';
        }

        if (widgetId === 'favoriteTrack') {
          smallWidgetsStyles[widgetId].justifyContent = 'space-between';
        }
      }
    });

    return { mainWidgetStyle, smallWidgetsStyles };
  },

  // Получить конфигурацию для bottom-section
  getBottomSectionStyle(state) {
    if (!state) {
      return { display: 'none' };
    }

    const visibleCount = this.getVisibleSmallCount(state);

    if (visibleCount === 0) {
      return {
        display: 'none'
      };
    }

    // Четкая фиксированная высота для секции виджетов
    return {
      height: '180px',
      minHeight: '180px',
      maxHeight: '180px',
      flexShrink: 0,
      flexGrow: 0
    };
  }
};

export default WidgetManager;