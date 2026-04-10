-- 种子数据：26 个键盘音效（a-z 各一个）
-- 在 Supabase Dashboard → SQL Editor 粘贴执行
-- 名称参考 Patatap Set A，分类按音色特征归类

insert into sounds (token_id, name, audio_url, duration_ms, category, key) values
  (109, 'Bubbles',        '/sounds/a.mp3', 800,  'effect',     'a'),
  (110, 'Clay',           '/sounds/b.mp3', 600,  'percussion', 'b'),
  (111, 'Confetti',       '/sounds/c.mp3', 900,  'effect',     'c'),
  (112, 'Corona',         '/sounds/d.mp3', 1200, 'effect',     'd'),
  (113, 'Dotted Spiral',  '/sounds/e.mp3', 700,  'effect',     'e'),
  (114, 'Flash 1',        '/sounds/f.mp3', 300,  'percussion', 'f'),
  (115, 'Flash 2',        '/sounds/g.mp3', 350,  'percussion', 'g'),
  (116, 'Flash 3',        '/sounds/h.mp3', 400,  'percussion', 'h'),
  (117, 'Glimmer',        '/sounds/i.mp3', 1000, 'melody',     'i'),
  (118, 'Moon',           '/sounds/j.mp3', 1500, 'melody',     'j'),
  (119, 'Pinwheel',       '/sounds/k.mp3', 800,  'effect',     'k'),
  (120, 'Piston 1',       '/sounds/l.mp3', 250,  'percussion', 'l'),
  (121, 'Piston 2',       '/sounds/m.mp3', 300,  'percussion', 'm'),
  (122, 'Piston 3',       '/sounds/n.mp3', 350,  'percussion', 'n'),
  (123, 'Prism 1',        '/sounds/o.mp3', 1100, 'melody',     'o'),
  (124, 'Prism 2',        '/sounds/p.mp3', 1200, 'melody',     'p'),
  (125, 'Prism 3',        '/sounds/q.mp3', 1300, 'melody',     'q'),
  (126, 'Splits',         '/sounds/r.mp3', 500,  'percussion', 'r'),
  (127, 'Squiggle',       '/sounds/s.mp3', 600,  'effect',     's'),
  (128, 'Strike',         '/sounds/t.mp3', 200,  'percussion', 't'),
  (129, 'Suspension',     '/sounds/u.mp3', 1800, 'melody',     'u'),
  (130, 'Timer',          '/sounds/v.mp3', 400,  'percussion', 'v'),
  (131, 'UFO',            '/sounds/w.mp3', 1000, 'effect',     'w'),
  (132, 'Veil',           '/sounds/x.mp3', 1400, 'melody',     'x'),
  (133, 'Wipe',           '/sounds/y.mp3', 500,  'effect',     'y'),
  (134, 'Zig-Zag',        '/sounds/z.mp3', 600,  'effect',     'z');

-- token_id 109-134 对应 Sound 接口定义
-- duration_ms 是估算值，后续可根据实际音频调整
-- category 分类：percussion(打击) / melody(旋律) / effect(音效)
