package com.example.model

import java.util.Calendar

data class SyllabusUnit(
    val unitNumber: Int,
    val unitName: String,
    val description: String,
    val totalEstimatedQuestions: Int = 10
)

data class SyllabusSubject(
    val id: String,
    val name: String,
    val code: String,
    val streams: List<AcademicStream>,
    val units: List<SyllabusUnit>
)

data class QuizQuestion(
    val id: String,
    val subjectId: String,
    val subjectName: String,
    val unitNumber: Int,
    val unitName: String,
    val questionText: String,
    val options: List<String>,
    val correctIndex: Int,
    val explanation: String
)

data class QuizSubmission(
    val id: String,
    val studentId: String,
    val studentName: String,
    val stream: AcademicStream,
    val subjectName: String,
    val unitNumber: Int,
    val score: Int,
    val totalQuestions: Int,
    val pointsEarned: Int,
    val spAwarded: Int,
    val timestamp: Long = System.currentTimeMillis()
)

enum class LeaderboardTimeframe(val title: String, val shortName: String) {
    ALL_TIME("All-Time Cumulative", "All-Time"),
    WEEKLY("This Week's Earned", "Weekly")
}

data class LeaderboardEntry(
    val rank: Int,
    val studentId: String,
    val studentName: String,
    val stream: AcademicStream,
    val score: Int,
    val timeTakenSeconds: Int = 0,
    val spEarned: Int = score,
    val isCurrentUser: Boolean = false,
    val subjectName: String = "Overall",
    val isAllTime: Boolean = false,
    val level: Int = 1
)

object QuizScheduleHelper {
    // Wednesday night 6:00pm (18:00) to 12:00am midnight (24:00 / 0:00)
    fun isWednesdayLiveWindow(): Boolean {
        val cal = Calendar.getInstance()
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)
        val timeInMinutes = hour * 60 + minute

        val isWednesday = dayOfWeek == Calendar.WEDNESDAY
        // Open from 6:00 PM (18:00) through 12:00 AM midnight (24:00 / 1440 minutes)
        val isWindowTime = timeInMinutes >= (18 * 60)
        return isWednesday && isWindowTime
    }

    // Results and Top 10 users are visible after Wednesday 12:00 AM midnight
    fun isWednesdayResultsAvailable(): Boolean {
        val cal = Calendar.getInstance()
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)
        val timeInMinutes = hour * 60 + minute

        // Available after Wednesday midnight (or on Thursday and beyond)
        // If it's Thursday or later, or Wednesday at 24:00 (which rolls into Thursday 00:00)
        return dayOfWeek != Calendar.WEDNESDAY || timeInMinutes >= (24 * 60)
    }

    fun getNextLiveTimeText(): String {
        return "Wednesday 6:00 PM – 12:00 AM (SLST)"
    }

    fun getResultsTimeText(): String {
        return "Wednesday after 12:00 AM Midnight (SLST)"
    }
}
