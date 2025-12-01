import { createTheme } from '@mui/material/styles';

/**
 * @description Tema dasar untuk aplikasi Material-UI.
 * Mendefinisikan palet warna primer dan sekunder.
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Warna biru yang mirip dengan sebelumnya
    },
    secondary: {
      main: '#dc004e', // Warna pink/merah untuk kontras
    },
  },
});

export default theme;
