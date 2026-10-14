import {
  emptyState,
  localDate,
  type AppState,
  type Meal,
  type Workout,
} from "./types";
export function demoState(): AppState {
  const s = emptyState();
  const now = new Date();
  const date = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return localDate(d);
  };
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const createdAt = now.toISOString();
  s.profile = {
    name: "Alex",
    goal: "performance",
    experience: "regular",
    trainingDays: 3,
    timeMinutes: 45,
    equipment: "gym",
    allergies: "",
    restrictions: "",
    language: "zh",
    units: "metric",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sleepGoal: 8,
    cloudConsent: false,
    aiConsent: false,
  };
  s.planVersions = [
    {
      id: id(1),
      parentId: null,
      createdAt,
      reason: "onboarding.initial",
      trainingMinutes: 45,
      trainingDays: 3,
      sleepHours: 8,
      calorieTarget: null,
      proteinTarget: null,
    },
  ];
  s.currentPlanId = id(1);
  const meal = (n: number, name: string, kcal: number, offset = 0): Meal => ({
    id: id(n),
    date: date(offset),
    name,
    type: n === 2 ? "breakfast" : "lunch",
    grams: 350,
    referenceGrams: 350,
    kcal,
    protein: 38,
    carbs: 54,
    fat: 17,
    source: "manual",
    createdAt,
  });
  s.meals = [
    meal(2, "鸡蛋燕麦早餐", 380),
    meal(3, "鸡肉杂粮碗", 520),
    meal(4, "酸奶与坚果", 520),
    meal(5, "牛肉蔬菜饭", 560, 1),
    meal(6, "三文鱼杂粮饭", 600, 2),
    meal(7, "鸡肉杂粮碗", 520, 3),
  ];
  const workout = (n: number, offset: number, duration: number): Workout => ({
    id: id(n),
    date: date(offset),
    name: "全身力量训练",
    duration,
    rpe: 6,
    exercises: [
      { name: "高脚杯深蹲", sets: 3, reps: 10, weight: 16 },
      { name: "哑铃划船", sets: 3, reps: 12, weight: 12 },
      { name: "俯卧撑", sets: 3, reps: 10, weight: 0 },
    ],
    notes: "",
    createdAt,
  });
  s.workouts = [workout(10, 0, 45), workout(11, 2, 30), workout(12, 4, 35)];
  s.sleeps = [0, 1, 2, 3, 4].map((offset, index) => {
    const end = new Date(now);
    end.setDate(end.getDate() - offset);
    end.setHours(7, 32, 0, 0);
    const start = new Date(
      end.getTime() - (index === 0 ? 452 : 450 + index * 12) * 60000,
    );
    return {
      id: id(20 + index),
      date: date(offset),
      start: start.toISOString(),
      end: end.toISOString(),
      quality: 4,
      energy: 4,
      source: "manual",
      timezone: s.profile!.timezone,
      createdAt,
    };
  });
  s.completedActions[date(0)] = ["nutrition", "training"];
  return s;
}
