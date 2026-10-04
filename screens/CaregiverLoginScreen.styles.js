import { StyleSheet } from 'react-native';
import { NAVY, TEXT_DARK, WHITE } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
    paddingHorizontal: '7%',
  },
  centerContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingVertical: 24,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    color: NAVY,
    textAlign: 'center',
    alignSelf: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    color: TEXT_DARK,
    textAlign: 'center',
    alignSelf: 'center',
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: NAVY,
    alignSelf: 'flex-start',
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 8,
    color: NAVY,
    width: '100%',
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    color: '#C0392B',
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: NAVY,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    fontFamily: 'DMSans_700Bold',
    color: WHITE,
  },
  registerText: {
    fontFamily: 'DMSans_400Regular',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  registerLink: {
    fontFamily: 'DMSans_700Bold',
    color: TEXT_DARK,
  },
  backLink: {
    fontFamily: 'DMSans_500Medium',
    color: TEXT_DARK,
    textAlign: 'center',
  },
});