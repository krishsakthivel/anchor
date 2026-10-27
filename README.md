# Anchor
Anchor is a platform for caregivers to connect with and manage care recipients. It allows caregivers to assign tasks, add medications, log vitals, and provides tools to lighten the burden of caregiving. 

## Features

### Pairing & Dashboard
Anchor helps caregivers connect with patients with a simple 8-digit pairing code that they can create and reset. Caregivers can manage all their patients from a single dashboard, which also includes information on daily progress, mood check-ins, and medication supplies.

### Medication Management
A main feature of Anchor is its medication management system. Caregivers can add medicines, set dosages, write instructions, and schedule daily reminders. Both caregivers and care recipients get notifications about upcoming medications, and caregivers can track medication supplies and get low stock 
warnings. Caregivers can also assign daily tasks and create notes that appear directly on the patient’s home screen.

### Personalized Scheduling
Another main feature is the personalized schedule system for patients. Every morning, the care recipients answer 5 questions about sleep, energy, health, and preferences. Anchor uses these answers to automatically generate a personalized daily schedule in the care recipient's best interest. Caregivers can also adjust the generated schedule, and the recipients also receive reminders before activities start.

### Health Tracking
Anchor also helps caregivers monitor and see their patients’ physical and emotional well-being. Patients can log up to 6 different vital signs, such as blood pressure, heart rate, or blood sugar. They can also do mood check-ins using emojis and optional notes, which helps the caregivers understand how the care recipient is feeling.

### Daily Routines & Reports
For daily routines, patients and caregivers can view medications and assigned tasks in a checklist and mark medications as taken, missed, or skipped, and tasks as completed or skipped. Caregivers can also review weekly reports that show missed activities, medication-use consistency, and task completion percentages.

### Accessibility
Lastly, Anchor offers accessibility features such as large buttons, very simple patient screens, and large caregiver and emergency-calling buttons.

## Challenges
During programming, we faced issues with managing code among 3 people, our database schema, making our UI as user-friendly as possible, and implementing other features. 

Throughout our time programming this app, managing the code between 3 people caused many issues, most notably misunderstandings of code blocks and structure. Since we all had different coding styles, we hit many roadblocks when transferring code, especially when we were all working on the same feature. To solve this, we used commenting and AI to make our code more readable and more industry-standard. We used readability optimization to help us avoid getting lost.

Next up, our database schema grew to over 22 tables over time. This caused us to spend hours debugging, mainly because if there was a bug, we had to search cell by cell through each table, then find the issue in the code. Working through this problem was difficult because there is no easy solution to a complex situation. We found that putting a visual of our database side by side helped us visualize where everything went and how our line of code would fit into the schema.

Also, we wanted to make our user interface as simple as possible, especially for patients, because we were concerned it might become too complex. To do this, we spent hours researching which features would help, and after that, implementation was the hardest part. To make important buttons even a little bigger, we had to completely re-sketch our interface. 

Finally, we had many problems with feature implementations. Our medication tracking system sometimes didn’t allow us to edit its data, and sometimes the buttons to indicate the medications were taken wouldn’t work either. We also couldn’t add tasks at one point because of a database-side bug. All of this was traced back to database issues, so we resolved it by running multiple SQL queries in Supabase to identify the problem.

Out of the many difficulties we faced, these were the ones we struggled with most.

## What We Learned
During participation in the Congressional App Challenge, we learned a lot about React Native, database management, and securing user data. React Native was a relatively new framework for all of us except Krish, so we worked together to push through the syntax challenges. It was hard at first, but all of us were able to take away many concepts from React Native, including components, how to initialize the Expo environment, and more.

We also learned a lot about database management using SQL. We used Supabase, and at first, creating tables and cells was a huge accomplishment for us. As we progressed, we learned what RLS was, what primary and foreign keys were, and JOINs (primary and foreign keys were super confusing!)

Learning how to use AI efficiently and effectively was a major breakthrough. We didn’t want to succumb to the trap of becoming AI-only programmers. It was enticing at first, especially because we were just climbing the barrier of learning an entire framework for making our app, but we pushed through and learned that AI is honestly far more useful as a partner that reviews code and does the repetitive stuff, or as Krish likes to call it, “our little unpaid intern.” 

Lastly, the most important thing we learned is to build as a team. We all came in with different personalities, different mindsets, and different coding styles. We spent hours brainstorming but could never agree on a single idea. After countless calls, we finally decided to make a compromise and combine the ideas. We learned that instead of arguing about whose idea is better, we should listen to each other and focus on what would make our app better. Throughout development, we learned to work around each other's coding styles, communicate well, and solve problems together. In the end, we all realized how building an app is more about being a good teammate than an extraordinary coder.

## Roadmap (Anchor 2.0)
We have so many improvements and new features we would put into a 2.0 version of our app. First, we would add a family group feature, much like Life360’s families feature. We would create this so families can gain more insight into their loved ones’ lives and easily connect with the caregiver to ask any questions they have. We would also build a privacy feature to protect the patients, while still providing the family with accurate information.

Secondly, we would also create graphable data so the caregiver would have more insight into their patient’s mental and physical health. We also really want our app to be more tablet-compatible. It meets tablet compatibility requirements, but there are still a few UI bugs on other tablets. We would also add many more accessibility features, such as support for colorblind users, theme switching, more UI customization, in-app support for Read Aloud, and other languages.

Lastly, we would add other features, such as in-app messaging. We would create pre-made sentences and phrases to help patients communicate more easily and effectively, and use a good UI to improve accessibility. We would also integrate wearable devices, such as smartwatches, to automatically track heart rate, activity, and other health metrics, with the patient’s permission.




