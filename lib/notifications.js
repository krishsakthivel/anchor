import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planLabels } from './dailyPlan';
const { settleReminderOperations } = require('./reminderLifecycle');
const { medicationReminderTriggers } = require('./reminderSchedule');
const { activePlanEntries } = require('./planActivities');

const { createReminderLifecycle } = require('./reminderLifecycle');
const reminderLifecycle = createReminderLifecycle(async () => {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
});
export const setReminderUser = userId => reminderLifecycle.setUser(userId);

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

export function schedulePatientMedicationReminders(medications, userId) {
  return reminderLifecycle.run(userId, async () => {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await settleReminderOperations(scheduled
    .filter((notification) => notification.content.data?.kind === 'medication-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await settleReminderOperations(medications
    .flatMap((medication) => medicationReminderTriggers(medication.schedule_time, medication.days, 15)
      .map((trigger) => Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medicine in 15 minutes',
          body: `${medication.name} is coming up at ${medication.schedule_time}.`,
          data: { kind: 'medication-reminder', medicationId: medication.id, scheduleId: medication.schedule_id },
        },
        trigger: { ...trigger, channelId: 'care-reminders' },
      }))));
  });
}

export function schedulePlanReminders(blocks, userId) {
  return reminderLifecycle.run(userId, async () => {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await settleReminderOperations(scheduled
    .filter((notification) => notification.content.data?.kind === 'plan-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  const now = new Date();
  await settleReminderOperations(activePlanEntries(blocks).map(({ block }) => block)
    .filter((block) => block.start && block.type !== 'medicine')
    .map((block) => {
      const [hour, minute] = block.start.split(':').map(Number);
      const reminderDate = new Date();
      reminderDate.setHours(hour, minute - 5, 0, 0);
      if (reminderDate <= now) return null;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'Coming up in 5 minutes',
          body: block.location_name ? `Go to ${block.location_name} for ${block.title || planLabels[block.type] || 'your activity'}.` : (block.title || 'Your next scheduled activity is starting soon.'),
          data: { kind: 'plan-reminder' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate, channelId: 'care-reminders' },
      });
    }).filter(Boolean));
  });
}

export function scheduleCaregiverMedicationReminders(entries, userId) {
  return reminderLifecycle.run(userId, async () => {
  if (!(await enableReminders())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await settleReminderOperations(scheduled
    .filter((notification) => notification.content.data?.kind === 'caregiver-medication-reminder')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await settleReminderOperations(entries.flatMap((entry) => medicationReminderTriggers(entry.time, entry.days, 60)
    .map((trigger) => Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medicine in 1 hour',
        body: `${entry.patientName}'s ${entry.medicationName} is coming up at ${entry.time}.`,
        data: { kind: 'caregiver-medication-reminder', patientId: entry.patientId },
      },
      trigger: { ...trigger, channelId: 'care-reminders' },
    }))));
  });
}
