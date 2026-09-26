import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function enableReminders() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('care-reminders', {
      name: 'Care reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.status === 'granted'
    ? current.status
    : (await Notifications.requestPermissionsAsync()).status;
  return status === 'granted';
}

export async function schedulePatientMedicationReminders(medications) {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((notification) => notification.content.data?.kind === 'medication-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await Promise.all(medications
    .filter((medication) => medication.schedule_time)
    .map((medication) => {
      const [hour, minute] = medication.schedule_time.split(':').map(Number);
      const reminderMinute = minute >= 15 ? minute - 15 : minute + 45;
      const reminderHour = minute >= 15 ? hour : (hour + 23) % 24;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medicine in 15 minutes',
          body: `${medication.name} is coming up at ${medication.schedule_time}.`,
          data: { kind: 'medication-reminder', medicationId: medication.id },
        },
        trigger: { hour: reminderHour, minute: reminderMinute, repeats: true, channelId: 'care-reminders' },
      });
    }));
}

export async function schedulePlanReminders(blocks) {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((notification) => notification.content.data?.kind === 'plan-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await Promise.all(blocks
    .filter((block) => block.start)
    .map((block) => {
      const [hour, minute] = block.start.split(':').map(Number);
      const reminderMinute = minute >= 5 ? minute - 5 : minute + 55;
      const reminderHour = minute >= 5 ? hour : (hour + 23) % 24;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'Coming up in 5 minutes',
          body: block.title || 'Your next scheduled activity is starting soon.',
          data: { kind: 'plan-reminder' },
        },
        trigger: { hour: reminderHour, minute: reminderMinute, repeats: true, channelId: 'care-reminders' },
      });
    }));
}

export async function scheduleCaregiverMedicationReminders(entries) {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((notification) => notification.content.data?.kind === 'caregiver-medication-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await Promise.all(entries.map((entry) => {
    const [hour, minute] = entry.time.split(':').map(Number);
    const reminderMinute = minute;
    const reminderHour = (hour + 23) % 24;
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medicine in 1 hour',
        body: `${entry.patientName}'s ${entry.medicationName} is coming up at ${entry.time}.`,
        data: { kind: 'caregiver-medication-reminder', patientId: entry.patientId },
      },
      trigger: { hour: reminderHour, minute: reminderMinute, repeats: true, channelId: 'care-reminders' },
    });
  }));
}
