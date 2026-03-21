
UPDATE nutrition_logs 
SET 
  ai_score = 75,
  ai_feedback = 'Завтрак и обед были очень сбалансированными и соответствовали рекомендациям. Положительно отметить большое количество овощей и достаточное количество белка. Ужин был слишком богат углеводами для ночного приема пищи, а перекус мог бы быть лучше с добавлением белка.',
  ai_analysis = '{
    "overall_score": 75,
    "total_calories": 1690,
    "total_protein_g": 115,
    "total_carbs_g": 139,
    "total_fat_g": 85,
    "analysis_count": 1,
    "meals": [
      {
        "photo_index": 0,
        "meal_type": "breakfast",
        "detected_foods": [
          {"name": "Scrambled eggs", "portion_g": 150, "calories": 231, "protein_g": 19, "carbs_g": 2, "fat_g": 17},
          {"name": "Whole-wheat bread with cheese", "portion_g": 60, "calories": 180, "protein_g": 10, "carbs_g": 18, "fat_g": 8},
          {"name": "Shredded cabbage salad", "portion_g": 80, "calories": 20, "protein_g": 1, "carbs_g": 4, "fat_g": 0},
          {"name": "Carrot salad (korean style)", "portion_g": 80, "calories": 96, "protein_g": 1, "carbs_g": 8, "fat_g": 6}
        ],
        "estimated_calories": 527, "protein_g": 31, "carbs_g": 32, "fat_g": 31,
        "protein_adequate": true, "vegetables_present": true, "score": 90,
        "issues": [],
        "positives": ["Good source of protein from eggs and cheese.", "Includes complex carbohydrates from whole-wheat bread.", "Excellent variety of vegetables (cabbage, carrots), providing fiber and micronutrients."]
      },
      {
        "photo_index": 1,
        "meal_type": "lunch",
        "detected_foods": [
          {"name": "Beef stew with mashed potatoes", "portion_g": 300, "calories": 450, "protein_g": 35, "carbs_g": 30, "fat_g": 25},
          {"name": "Green salad with cucumber and seeds", "portion_g": 250, "calories": 150, "protein_g": 5, "carbs_g": 10, "fat_g": 10}
        ],
        "estimated_calories": 600, "protein_g": 40, "carbs_g": 40, "fat_g": 35,
        "protein_adequate": true, "vegetables_present": true, "score": 95,
        "issues": [],
        "positives": ["Excellent protein source from beef stew.", "Generous portion of green salad with cucumber.", "Salad includes healthy fats from seeds."]
      },
      {
        "photo_index": 2,
        "meal_type": "snack",
        "detected_foods": [
          {"name": "Pear", "portion_g": 170, "calories": 95, "protein_g": 1, "carbs_g": 25, "fat_g": 0}
        ],
        "estimated_calories": 95, "protein_g": 1, "carbs_g": 25, "fat_g": 0,
        "protein_adequate": false, "vegetables_present": false, "score": 75,
        "issues": ["Lacks protein. Adding a protein source would make it more satiating."],
        "positives": ["Healthy and natural snack choice (fruit).", "Provides natural sugars and fiber."]
      },
      {
        "photo_index": 3,
        "meal_type": "dinner",
        "detected_foods": [
          {"name": "Cottage cheese casserole", "portion_g": 150, "calories": 350, "protein_g": 25, "carbs_g": 35, "fat_g": 15},
          {"name": "Sour cream", "portion_g": 50, "calories": 68, "protein_g": 1, "carbs_g": 2, "fat_g": 6},
          {"name": "Herbal tea", "portion_g": 200, "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
        ],
        "estimated_calories": 468, "protein_g": 43, "carbs_g": 42, "fat_g": 19,
        "protein_adequate": true, "vegetables_present": false, "score": 60,
        "issues": ["High in carbohydrates for a dinner meal.", "Lacks green vegetables.", "Cottage cheese casserole often contains added sugar and flour."],
        "positives": ["Good source of protein from cottage cheese.", "Includes herbal tea."]
      }
    ],
    "summary_ru": "Завтрак и обед были очень сбалансированными и соответствовали рекомендациям. Положительно отметить большое количество овощей и достаточное количество белка. Ужин был слишком богат углеводами для ночного приема пищи, а перекус мог бы быть лучше с добавлением белка.",
    "summary_en": "Breakfast and lunch were very balanced and aligned well with the guidelines. Dinner was too carbohydrate-heavy for an evening meal, and the snack could have benefited from added protein."
  }'::jsonb
WHERE id = 'ed5b9498-c241-4bb2-82ad-3c6fe5d46a65';
