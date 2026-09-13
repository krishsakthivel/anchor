import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NAVY, WHITE } from '../theme/colors';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message || 'An unexpected error occurred.'}</Text>
          <TouchableOpacity onPress={this.handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WHITE,
    padding: 24,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: NAVY,
    marginBottom: 12,
  },
  message: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: NAVY,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: WHITE,
  },
});