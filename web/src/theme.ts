/**
 * The one place to re-skin Camp: colours, fonts, radius, default component props.
 * Swap `primaryColor` for any Mantine palette name (or add your own 10-shade tuple under `colors`).
 */
import { createTheme, type MantineColorsTuple } from '@mantine/core';

const campfire: MantineColorsTuple = [
  '#eafbee', '#dbf2e0', '#b9e3c3', '#94d4a3', '#74c788',
  '#5fbe76', '#53ba6d', '#42a35b', '#379150', '#277d42',
];

export const theme = createTheme({
  primaryColor: 'campfire',
  colors: { campfire },
  primaryShade: 7,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: '700' },
  defaultRadius: 'md',
  components: {
    Card: { defaultProps: { withBorder: true, shadow: 'xs', radius: 'md' } },
    Paper: { defaultProps: { withBorder: true, radius: 'md' } },
  },
});
