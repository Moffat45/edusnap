/*
 * File:    EduSnap.java
 * Author:  Group [number] - ICT First Year JGA 2026
 * Date:    2026
 * Purpose: Console prototype of EduSnap, an AI homework-help service for
 *          Grade 8-12 learners (freemium: Free, Snap & Learn R49, Family R89).
 *          Menu-driven; the Phase 1 revenue maths is coded here.
 */

import java.util.Scanner;

public class EduSnap {

    // ---- Parameters (fixed for now) ----
    static final double FEE_SNAP = 49.00;        // Snap & Learn, rand per month
    static final double FEE_FAMILY = 89.00;      // Family plan, rand per month
    static final double SERVER_COST = 5.00;      // rand per user per month
    static final double HOSTING = 150.00;        // rand per month
    static final int FREE_PER_DAY = 5;           // free questions per day
    static final int PAID_PER_MONTH = 100;       // questions per month on paid plans
    static final String[] PLANS = {"Free (R0)", "Snap & Learn (R49/month)", "Family (R89/month)"};
    static final String[] SUBJECTS = {"Mathematics", "Physical Sciences", "Accounting", "ICT / IT", "English"};
    static final String[] MONTHS = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
    static final int[] SUBSCRIBERS = {100, 250, 500, 583, 680, 794, 926, 1080, 1260, 1470, 1714, 2000};

    // ---- Variables (change during the run) ----
    static int plan = 0;                // 0 = Free, 1 = Snap & Learn, 2 = Family
    static int questionsToday = 0;
    static int questionsThisMonth = 0;
    static double totalPaid = 0.0;

    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int choice;
        do {
            showMenu();
            choice = readInt(input, "Choose an option (1-6): ", 1, 6);
            switch (choice) {
                case 1: choosePlan(input); break;
                case 2: askQuestion(input); break;
                case 3: projectRevenue(input); break;
                case 4: yearOneTable(); break;
                case 5: showSummary(); break;
                case 6: System.out.println("Thank you for using EduSnap. Goodbye!"); break;
            }
        } while (choice != 6);
        input.close();
    }

    // Prints the main menu
    static void showMenu() {
        System.out.println("\n===== EduSnap: Snap a question, get an answer =====");
        System.out.println("1. Choose or upgrade a plan");
        System.out.println("2. Ask a homework question");
        System.out.println("3. Project monthly revenue and profit");
        System.out.println("4. View year 1 projection");
        System.out.println("5. View summary");
        System.out.println("6. Exit");
    }

    // Option 1: pick a plan and pay if it is a paid plan
    static void choosePlan(Scanner input) {
        System.out.println("\nPlans:");
        for (int i = 0; i < PLANS.length; i++) {
            System.out.println((i + 1) + ". " + PLANS[i]);
        }
        int pick = readInt(input, "Choose a plan (1-3): ", 1, 3) - 1;
        double fee = planFee(pick);
        if (fee > 0) {
            double paid = readDouble(input, "Enter payment in rand (R" + fee + " required): ", fee, 10000);
            totalPaid += fee;
            System.out.println("Payment received. Change: R" + String.format("%.2f", paid - fee));
        }
        plan = pick;
        questionsThisMonth = 0;
        System.out.println("You are now on the " + PLANS[plan] + " plan.");
    }

    // Option 2: ask a question, checking the limits of the current plan
    static void askQuestion(Scanner input) {
        System.out.println("\nSubjects:");
        for (int i = 0; i < SUBJECTS.length; i++) {
            System.out.println((i + 1) + ". " + SUBJECTS[i]);
        }
        int subject = readInt(input, "Choose a subject (1-" + SUBJECTS.length + "): ", 1, SUBJECTS.length);
        int grade = readInt(input, "Enter your grade (8-12): ", 8, 12);
        int type = readInt(input, "1 = type the question, 2 = photo of the question: ", 1, 2);
        if (type == 2 && plan == 0) {
            System.out.println("Photo questions need Snap & Learn or Family. Please upgrade in option 1.");
            return;
        }
        if (!withinLimit()) {
            System.out.println(plan == 0
                    ? "You have used your " + FREE_PER_DAY + " free questions today. Come back tomorrow or upgrade."
                    : "You have used your " + PAID_PER_MONTH + " questions this month.");
            return;
        }
        questionsToday++;
        questionsThisMonth++;
        System.out.println("Question received (" + SUBJECTS[subject - 1] + ", Grade " + grade
                + "). A step-by-step explanation is on its way.");
    }

    // Checks whether the learner may ask another question
    static boolean withinLimit() {
        if (plan == 0) {
            return questionsToday < FREE_PER_DAY;
        }
        return questionsThisMonth < PAID_PER_MONTH;
    }

    // Option 3: revenue and profit for a number of subscribers (all on R49)
    static void projectRevenue(Scanner input) {
        int users = readInt(input, "Number of paying subscribers (1-100000): ", 1, 100000);
        double revenue = users * FEE_SNAP;
        double serverCosts = users * SERVER_COST;
        double profitBefore = revenue - serverCosts;
        double net = profitBefore - HOSTING;
        System.out.println("Monthly revenue:         R" + String.format("%.2f", revenue));
        System.out.println("Server costs:            R" + String.format("%.2f", serverCosts));
        System.out.println("Profit before hosting:   R" + String.format("%.2f", profitBefore));
        System.out.println("Net profit (after R150): R" + String.format("%.2f", net));
    }

    // Option 4: the 12-month table, with totals
    static void yearOneTable() {
        double totalRevenue = 0, totalNet = 0;
        System.out.println("\nMonth  Subscribers      Revenue   Net profit");
        for (int i = 0; i < MONTHS.length; i++) {
            double revenue = SUBSCRIBERS[i] * FEE_SNAP;
            double net = revenue - SUBSCRIBERS[i] * SERVER_COST - HOSTING;
            totalRevenue += revenue;
            totalNet += net;
            System.out.printf("%-6s %11d %12.2f %12.2f%n", MONTHS[i], SUBSCRIBERS[i], revenue, net);
        }
        System.out.printf("Year 1 total revenue: R%.2f, net profit: R%.2f%n", totalRevenue, totalNet);
        System.out.println("Mean monthly revenue: R" + String.format("%.2f", totalRevenue / MONTHS.length));
    }

    // Option 5: show the learner's totals for this run
    static void showSummary() {
        System.out.println("\n--- Summary ---");
        System.out.println("Current plan:        " + PLANS[plan]);
        System.out.println("Questions today:     " + questionsToday);
        System.out.println("Questions this month:" + " " + questionsThisMonth);
        System.out.println("Total paid:          R" + String.format("%.2f", totalPaid));
    }

    // Monthly fee for a plan index
    static double planFee(int p) {
        if (p == 1) return FEE_SNAP;
        if (p == 2) return FEE_FAMILY;
        return 0.0;
    }

    // Reads a whole number within a range; asks again on bad input
    static int readInt(Scanner input, String prompt, int min, int max) {
        while (true) {
            System.out.print(prompt);
            String line = input.nextLine().trim();
            try {
                int value = Integer.parseInt(line);
                if (value >= min && value <= max) {
                    return value;
                }
            } catch (NumberFormatException e) {
                // fall through to the message below
            }
            System.out.println("Please enter a whole number between " + min + " and " + max + ".");
        }
    }

    // Reads a decimal number within a range; asks again on bad input
    static double readDouble(Scanner input, String prompt, double min, double max) {
        while (true) {
            System.out.print(prompt);
            String line = input.nextLine().trim();
            try {
                double value = Double.parseDouble(line);
                if (value >= min && value <= max) {
                    return value;
                }
            } catch (NumberFormatException e) {
                // fall through to the message below
            }
            System.out.println("Please enter an amount between " + min + " and " + max + ".");
        }
    }
}
