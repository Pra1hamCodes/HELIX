export const COLORS = {
  bg:      '#020409',
  surface: '#080d1a',
  card:    '#0b1220',
  accent:  '#00f5ff',
  green:   '#00ff88',
  purple:  '#7b2fff',
  red:     '#ff2244',
  yellow:  '#ffd60a',
  orange:  '#ff9900',
  pink:    '#ff66aa',
  muted:   '#3a5070',
  text:    '#cce8ff',
  dim:     '#8aaccc',
}

export const ATTACK_PALETTE = {
  'BENIGN':                     '#00ff88',
  'DoS Hulk':                   '#ff2244',
  'DoS GoldenEye':              '#ff4466',
  'DoS slowloris':              '#ff3355',
  'DoS Slowhttptest':           '#cc1133',
  'DDoS':                       '#ff5533',
  'FTP-Patator':                '#00c8ff',
  'SSH-Patator':                '#0099ff',
  'PortScan':                   '#ffd60a',
  'Bot':                        '#aa44ff',
  'Web Attack - Brute Force':   '#00ff88',
  'Web Attack - XSS':           '#44ffaa',
  'Web Attack - Sql Injection': '#22ddff',
  'Infiltration':               '#ff9900',
  'Heartbleed':                 '#ff66aa',
}

export function getAttackColor(label = '') {
  const l = String(label).trim()
  if (ATTACK_PALETTE[l]) return ATTACK_PALETTE[l]
  const u = l.toUpperCase()
  if (u.includes('BENIGN'))      return '#00ff88'
  if (u.includes('DDOS'))        return '#ff5533'
  if (u.includes('DOS'))         return '#ff2244'
  if (u.includes('PORTSCAN'))    return '#ffd60a'
  if (u.includes('BOT'))         return '#aa44ff'
  if (u.includes('FTP') || u.includes('SSH') || u.includes('BRUTE')) return '#00c8ff'
  if (u.includes('WEB'))         return '#44ffaa'
  if (u.includes('INFILTRATION')) return '#ff9900'
  if (u.includes('HEARTBLEED'))  return '#ff66aa'
  return '#3a5070'
}

export const CHART_COLORS = [
  '#00f5ff', '#00ff88', '#7b2fff', '#ffd60a',
  '#ff2244', '#ff9900', '#00c8ff', '#ff66aa',
  '#44ffaa', '#aa44ff', '#ff5533', '#22ddff',
]
