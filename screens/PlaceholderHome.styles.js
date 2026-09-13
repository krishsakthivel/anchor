import { StyleSheet } from 'react-native';
import { NAVY, TEXT_DARK, WHITE } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '7%',
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    color: NAVY,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    color: TEXT_DARK,
    textAlign: 'center',
  },
});