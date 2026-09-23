package com.example.ui.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.UserAchievement
import com.example.model.UserProfile
import com.example.ui.theme.*

@Composable
fun AchievementsSection(
    user: UserProfile,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableStateOf("All") }
    var showOnlyUnlocked by remember { mutableStateOf(false) }
    var selectedAchievementForDetail by remember { mutableStateOf<UserAchievement?>(null) }

    val allAchievements = remember(user) { user.getAchievements() }

    val unlockedCount = remember(allAchievements) {
        allAchievements.count { it.isUnlocked }
    }
    val totalSpBonus = remember(allAchievements) {
        allAchievements.filter { it.isUnlocked }.sumOf { it.spReward }
    }
    val completionFraction = if (allAchievements.isNotEmpty()) {
        unlockedCount.toFloat() / allAchievements.size
    } else 0f

    val filteredAchievements = remember(allAchievements, selectedCategory, showOnlyUnlocked) {
        allAchievements.filter { achievement ->
            val matchesCategory = (selectedCategory == "All") || (achievement.category == selectedCategory)
            val matchesLockFilter = !showOnlyUnlocked || achievement.isUnlocked
            matchesCategory && matchesLockFilter
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("card_profile_achievements"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(ZahiraGold.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.EmojiEvents,
                            contentDescription = "Achievements",
                            tint = ZahiraMaroon,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "HONORS & ACHIEVEMENTS",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = ZahiraMaroon
                        )
                        Text(
                            text = "Unlock badges through study, quizzes & mastery",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = ZahiraGold.copy(alpha = 0.18f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ZahiraGold.copy(alpha = 0.6f))
                ) {
                    Text(
                        text = "$unlockedCount / ${allAchievements.size} UNLOCKED",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF92400E),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Overall Progress Strip Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFF8FAFC),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Overall Mastery Progress (${(completionFraction * 100).toInt()}%)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "+$totalSpBonus SP Bonus Earned",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = ZahiraMaroon
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { completionFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = ZahiraGold,
                        trackColor = Color(0xFFE2E8F0)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Filter Chips Bar
            val categories = listOf("All", "Academic", "Contests", "Dedication", "Milestones")
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(categories) { category ->
                    val isSelected = selectedCategory == category
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedCategory = category },
                        label = {
                            Text(
                                text = category,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ZahiraMaroon,
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFFF1F5F9),
                            labelColor = TextPrimary
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = isSelected,
                            borderColor = Color.Transparent,
                            selectedBorderColor = Color.Transparent
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }

                item {
                    FilterChip(
                        selected = showOnlyUnlocked,
                        onClick = { showOnlyUnlocked = !showOnlyUnlocked },
                        leadingIcon = {
                            Icon(
                                if (showOnlyUnlocked) Icons.Default.CheckCircle else Icons.Default.LockOpen,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                        },
                        label = {
                            Text("Unlocked Only", fontSize = 11.sp)
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF065F46),
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFFF1F5F9),
                            labelColor = TextPrimary
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Achievements List
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.animateContentSize()
            ) {
                if (filteredAchievements.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No achievements match the selected filter.",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    }
                } else {
                    filteredAchievements.forEach { achievement ->
                        AchievementCardItem(
                            achievement = achievement,
                            onClick = { selectedAchievementForDetail = achievement }
                        )
                    }
                }
            }
        }
    }

    // Detail Dialog
    selectedAchievementForDetail?.let { achievement ->
        AlertDialog(
            onDismissRequest = { selectedAchievementForDetail = null },
            confirmButton = {
                TextButton(onClick = { selectedAchievementForDetail = null }) {
                    Text("Close", fontWeight = FontWeight.Bold, color = ZahiraMaroon)
                }
            },
            icon = {
                Text(achievement.iconEmoji, fontSize = 38.sp)
            },
            title = {
                Text(
                    text = achievement.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = achievement.description,
                        fontSize = 13.sp,
                        color = TextSecondary,
                        lineHeight = 18.sp
                    )
                    HorizontalDivider(color = Color(0xFFE2E8F0))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Category:", fontSize = 12.sp, color = TextSecondary)
                        Text(text = achievement.category, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ZahiraMaroon)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Reward:", fontSize = 12.sp, color = TextSecondary)
                        Text(text = "+${achievement.spReward} Science Points (SP)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF047857))
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Status:", fontSize = 12.sp, color = TextSecondary)
                        Text(
                            text = if (achievement.isUnlocked) "✅ Unlocked (${achievement.unlockedDate ?: "Earned"})" else "🔒 In Progress (${achievement.currentProgress}/${achievement.maxProgress})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (achievement.isUnlocked) Color(0xFF047857) else Color(0xFFD97706)
                        )
                    }
                }
            },
            shape = RoundedCornerShape(20.dp),
            containerColor = Color.White
        )
    }
}

@Composable
private fun AchievementCardItem(
    achievement: UserAchievement,
    onClick: () -> Unit
) {
    val progressFraction = (achievement.currentProgress.toFloat() / achievement.maxProgress.coerceAtLeast(1)).coerceIn(0f, 1f)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("item_achievement_${achievement.id}"),
        shape = RoundedCornerShape(14.dp),
        color = if (achievement.isUnlocked) Color(0xFFFFFBEB) else Color(0xFFF8FAFC),
        border = androidx.compose.foundation.BorderStroke(
            width = if (achievement.isUnlocked) 1.5.dp else 1.dp,
            color = if (achievement.isUnlocked) ZahiraGold.copy(alpha = 0.8f) else Color(0xFFE2E8F0)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Badge Avatar
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(
                        if (achievement.isUnlocked) {
                            Brush.linearGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A)))
                        } else {
                            Brush.linearGradient(listOf(Color(0xFFE2E8F0), Color(0xFFCBD5E1)))
                        }
                    )
                    .border(
                        width = 1.dp,
                        color = if (achievement.isUnlocked) ZahiraGold else Color(0xFF94A3B8),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = achievement.iconEmoji,
                    fontSize = 22.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Text Info & Progress
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = achievement.title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (achievement.isUnlocked) Color(0xFF78350F) else TextPrimary
                    )

                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = if (achievement.isUnlocked) Color(0xFFDCFCE7) else Color(0xFFF1F5F9)
                    ) {
                        Text(
                            text = if (achievement.isUnlocked) "UNLOCKED" else "${achievement.currentProgress}/${achievement.maxProgress}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = if (achievement.isUnlocked) Color(0xFF15803D) else TextSecondary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = achievement.description,
                    fontSize = 11.sp,
                    color = TextSecondary,
                    maxLines = 2,
                    lineHeight = 15.sp
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    LinearProgressIndicator(
                        progress = { progressFraction },
                        modifier = Modifier
                            .weight(1f)
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = if (achievement.isUnlocked) ZahiraGold else ZahiraMaroon.copy(alpha = 0.7f),
                        trackColor = Color(0xFFE2E8F0)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "+${achievement.spReward} SP",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (achievement.isUnlocked) Color(0xFF047857) else TextSecondary
                    )
                }
            }
        }
    }
}
