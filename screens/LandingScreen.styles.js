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
  hero: {
    alignItems: 'center',
  },
  tagline: {
    fontFamily: 'DMSans_500Medium',
    color: NAVY,
    textAlign: 'center',
    alignSelf: 'center',
  },
  formSection: {
    width: '100%',
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: NAVY,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 8,
    color: NAVY,
    width: '100%',
  },
  continueButton: {
    backgroundColor: NAVY,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontFamily: 'DMSans_700Bold',
    color: WHITE,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'DMSans_400Regular',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: 'DMSans_700Bold',
    color: TEXT_DARK,
    fontSize: 15,
  },
});