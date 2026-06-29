(function () {
  window.BokePlayerConfig = {
    modes: ['sequential', 'shuffle', 'loop'],
    modeConfig: {
      sequential: { icon: '➡️', label: '顺序播放', cls: 'mode-sequential' },
      shuffle: { icon: '🔀', label: '随机播放', cls: 'mode-shuffle' },
      loop: { icon: '🔁', label: '列表循环', cls: 'mode-loop' },
    },
    defaultMode: 'sequential',
  };
})();
