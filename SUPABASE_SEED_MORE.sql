-- ============================================================
-- Additional practice questions — fills Grade 8/9 gaps + adds the
-- 4 new CAPS subjects (Mathematical Literacy, Geography, Accounting,
-- Business Studies). Safe to re-run (ON CONFLICT DO NOTHING).
-- ============================================================

INSERT INTO public.practice_questions (subject, grade, question_text, model_answer, marks, difficulty) VALUES

-- ── English Home Language Grade 8 & 9 ──
('English Home Language', 8, 'What is a noun? Give two examples.', 'A noun is a word that names a person, place, thing or idea. Examples: "teacher" (person), "school" (place).', 3, 'easy'),
('English Home Language', 8, 'Underline the verb in this sentence: "The dog chased the cat."', 'chased', 2, 'easy'),
('English Home Language', 8, 'What is the difference between a fact and an opinion?', 'A fact can be proven true with evidence. An opinion is what someone thinks or feels — it cannot be proven.', 4, 'medium'),
('English Home Language', 9, 'Identify the figure of speech: "Her smile was as bright as the sun."', 'Simile — it compares two things using "as".', 3, 'easy'),
('English Home Language', 9, 'What is the difference between a main clause and a subordinate clause?', 'A main clause can stand alone as a complete sentence. A subordinate clause depends on a main clause and cannot stand alone.', 5, 'medium'),
('English Home Language', 9, 'Rewrite this sentence in the passive voice: "The learners completed the project."', 'The project was completed by the learners.', 3, 'medium'),

-- ── Life Sciences Grade 8 & 9 ──
('Life Sciences', 8, 'Name the five senses and the organ associated with each.', 'Sight (eyes), hearing (ears), smell (nose), taste (tongue), touch (skin).', 5, 'easy'),
('Life Sciences', 8, 'What is a producer in a food chain? Give one example.', 'A producer is an organism that makes its own food using sunlight (e.g. green plants, grass).', 3, 'easy'),
('Life Sciences', 8, 'List the three main parts of the human respiratory system.', 'Nose/mouth, trachea (windpipe), lungs (with bronchi and alveoli).', 4, 'medium'),
('Life Sciences', 9, 'What is the function of red blood cells?', 'Red blood cells transport oxygen from the lungs to the rest of the body, and carry carbon dioxide back to the lungs.', 4, 'medium'),
('Life Sciences', 9, 'Define photosynthesis and write its word equation.', 'Photosynthesis is the process plants use to make their own food using sunlight. Word equation: carbon dioxide + water → (sunlight + chlorophyll) → glucose + oxygen.', 5, 'medium'),
('Life Sciences', 9, 'Explain the difference between an organ and a tissue.', 'A tissue is a group of similar cells doing the same job (e.g. muscle tissue). An organ is made of different tissues working together (e.g. the heart).', 4, 'medium'),

-- ── Physical Sciences Grade 8 & 9 ──
('Physical Sciences', 8, 'Give an example of a physical change and a chemical change.', 'Physical change: ice melting into water (no new substance formed). Chemical change: wood burning to ash (new substance formed).', 4, 'easy'),
('Physical Sciences', 8, 'What are the three states of matter? Give one example of each.', 'Solid (ice), liquid (water), gas (steam/water vapour).', 3, 'easy'),
('Physical Sciences', 8, 'Name three forms of energy and an example of each.', 'Kinetic (a moving car), potential (water in a dam), heat (a stove element).', 4, 'medium'),
('Physical Sciences', 9, 'What is the unit of force, and what is one Newton?', 'The unit of force is the Newton (N). One Newton is the force needed to accelerate a 1 kg mass at 1 m/s².', 4, 'medium'),
('Physical Sciences', 9, 'Describe the structure of an atom in simple terms.', 'An atom has a nucleus in the middle made of protons (positive) and neutrons (no charge), with electrons (negative) orbiting around it.', 5, 'medium'),
('Physical Sciences', 9, 'A toy car has a mass of 0,5 kg and accelerates at 4 m/s². What is the net force on it?', 'F = ma = 0,5 × 4 = 2 N', 4, 'medium'),

-- ── History Grade 9 ──
('History', 9, 'What was the Great Trek and why did the Voortrekkers leave the Cape Colony?', 'The Great Trek (1830s–40s) was the migration of Dutch-speaking farmers (Voortrekkers) from the Cape into the interior of southern Africa. They left due to dissatisfaction with British rule, including the abolition of slavery, language policies, and border tensions.', 6, 'medium'),
('History', 9, 'Name two impacts of the Mineral Revolution on South Africa.', 'The discovery of diamonds (1867, Kimberley) and gold (1886, Witwatersrand) transformed SA: it brought industrialisation, mass migration of labour from rural areas, and laid the foundation for racially-segregated labour systems that fed into apartheid.', 6, 'medium'),

-- ── Mathematical Literacy (Grades 10, 11, 12) ──
('Mathematical Literacy', 10, 'A taxi charges R10 plus R2 per km. How much does a 15 km trip cost?', 'Cost = 10 + (2 × 15) = 10 + 30 = R40', 3, 'easy'),
('Mathematical Literacy', 10, 'Convert 75% to a decimal and to a fraction in simplest form.', '75% = 0,75 = 75/100 = 3/4', 3, 'easy'),
('Mathematical Literacy', 10, 'A shop offers 15% off a R250 shirt. What is the sale price?', 'Discount = 15% × 250 = R37,50. Sale price = 250 − 37,50 = R212,50.', 4, 'easy'),
('Mathematical Literacy', 11, 'A car uses 8 litres of petrol per 100 km. At R23/litre, how much does a 250 km trip cost?', 'Litres used = (8/100) × 250 = 20 L. Cost = 20 × 23 = R460.', 5, 'medium'),
('Mathematical Literacy', 11, 'Calculate VAT (15%) on a R1 200 purchase. What is the total?', 'VAT = 15% × 1 200 = R180. Total = 1 200 + 180 = R1 380.', 4, 'easy'),
('Mathematical Literacy', 12, 'A R5 000 investment earns simple interest at 8% per year for 3 years. Calculate the interest and final value.', 'Interest = P × r × t = 5 000 × 0,08 × 3 = R1 200. Final value = 5 000 + 1 200 = R6 200.', 5, 'medium'),
('Mathematical Literacy', 12, 'You earn R12 000 per month. Tax is 18% of earnings above R7 000. How much tax do you pay?', 'Taxable = 12 000 − 7 000 = R5 000. Tax = 18% × 5 000 = R900.', 5, 'medium'),

-- ── Geography (Grades 10, 11, 12) ──
('Geography', 10, 'Define weather and climate. How are they different?', 'Weather is the day-to-day condition of the atmosphere (temperature, rainfall, wind on a given day). Climate is the average weather of a region over a long period (usually 30+ years).', 4, 'easy'),
('Geography', 10, 'Name the two main types of rainfall and briefly describe each.', 'Convectional rainfall: warm air rises rapidly, cools, condenses (common in summer in SA highveld). Orographic (relief) rainfall: air is forced up over mountains, cools and rains (common on the eastern escarpment).', 6, 'medium'),
('Geography', 11, 'Explain the difference between renewable and non-renewable energy. Give one SA example of each.', 'Renewable energy is replenished naturally (e.g. wind, solar, hydro — SA has wind farms in the Eastern Cape). Non-renewable energy is finite (e.g. coal — Mpumalanga power stations).', 5, 'medium'),
('Geography', 11, 'What is urbanisation? Name two reasons why people move from rural to urban areas in South Africa.', 'Urbanisation is the increase in the proportion of people living in cities. SA push/pull factors: (1) better job opportunities in cities, (2) better access to services like healthcare and schools.', 5, 'medium'),
('Geography', 12, 'Describe the structure of a settlement hierarchy from smallest to largest.', 'Hamlet → village → town → city → metropolis → megacity. Each step has a larger population, more services and a wider sphere of influence.', 6, 'medium'),
('Geography', 12, 'What is a drainage basin and what are the main features of a river system?', 'A drainage basin is the area drained by a river and its tributaries. Main features: source (where it starts), tributaries (smaller rivers joining), watershed (boundary), mouth (where it ends — usually the sea).', 6, 'medium'),

-- ── Accounting (Grades 10, 11, 12) ──
('Accounting', 10, 'Define the accounting equation.', 'Owner''s Equity = Assets − Liabilities. (Or: Assets = Owner''s Equity + Liabilities.)', 3, 'easy'),
('Accounting', 10, 'Classify each as Asset, Liability or Owner''s Equity: (a) Bank loan, (b) Vehicles, (c) Capital.', '(a) Liability, (b) Asset, (c) Owner''s Equity.', 3, 'easy'),
('Accounting', 10, 'What is the difference between a debtor and a creditor?', 'A debtor is someone who owes you money (a customer who bought on credit). A creditor is someone you owe money to (a supplier who sold to you on credit).', 4, 'easy'),
('Accounting', 11, 'A business buys stock worth R5 000 on credit. Show the double entry (debit/credit).', 'Debit: Trading Stock R5 000. Credit: Creditors Control R5 000.', 5, 'medium'),
('Accounting', 11, 'Define depreciation and name one method of calculating it.', 'Depreciation is the loss in value of a fixed asset over time due to wear and tear or obsolescence. Methods: straight-line (equal amount each year) or diminishing balance (percentage of remaining value).', 5, 'medium'),
('Accounting', 12, 'Calculate the cost of sales given: Opening stock R20 000, Purchases R80 000, Closing stock R15 000.', 'Cost of sales = Opening stock + Purchases − Closing stock = 20 000 + 80 000 − 15 000 = R85 000.', 5, 'medium'),

-- ── Business Studies (Grades 10, 11, 12) ──
('Business Studies', 10, 'List three types of business ownership in South Africa.', 'Sole trader, partnership, close corporation (CC), private company (Pty) Ltd, public company (Ltd), co-operative.', 4, 'easy'),
('Business Studies', 10, 'What is the difference between a need and a want? Give one example of each.', 'A need is essential for survival (food, water, shelter). A want is desired but not essential (a smartphone, designer clothes).', 4, 'easy'),
('Business Studies', 11, 'Name and briefly describe two methods of advertising.', 'Print (newspapers, magazines — reaches specific readers but expensive). Digital/social media (Facebook, TikTok — targeted, measurable, often cheaper).', 5, 'medium'),
('Business Studies', 11, 'What is BBBEE and why is it important in South Africa?', 'Broad-Based Black Economic Empowerment is government policy to address historical economic inequality by encouraging ownership, management and skills development of previously disadvantaged groups. It is measured via a scorecard that affects government contracts.', 6, 'medium'),
('Business Studies', 12, 'Explain the four functions of management.', 'Planning (setting goals and how to reach them), Organising (allocating resources and people), Leading (motivating and directing staff), Controlling (measuring performance against the plan and correcting).', 8, 'medium'),
('Business Studies', 12, 'What is corporate social responsibility (CSR)? Give one example.', 'CSR is when a business takes responsibility for its impact on society and the environment beyond just making profit. Example: a mining company building a school in the community where it operates.', 5, 'medium')

ON CONFLICT DO NOTHING;
