package com.example.ui.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.UserProfile
import com.example.model.WeeklyTrendPoint
import com.example.ui.theme.*

enum class ChartMetricMode(val label: String) {
    WEEKLY_GAIN("Weekly Gain"),
    CUMULATIVE("Cumulative SP")
}

@Composable
fun WeeklySpTrendChartCard(
    user: UserProfile,
    modifier: Modifier = Modifier
) {
    var selectedSubject by remember { mutableStateOf("Overall") }
    var metricMode by remember { mutableStateOf(ChartMetricMode.WEEKLY_GAIN) }

    val points = remember(user, selectedSubject) {
        user.getWeeklySpTrendPoints(selectedSubject)
    }

    var selectedPointIndex by remember(points) {
        mutableIntStateOf(points.lastIndex)
    }

    val selectedPoint = points.getOrNull(selectedPointIndex) ?: points.last()

    // Calculate summary metrics
    val currentWeekSp = points.last().weeklySp
    val prevWeekSp = points.getOrNull(points.lastIndex - 1)?.weeklySp ?: currentWeekSp
    val growthPercent = if (prevWeekSp > 0) {
        ((currentWeekSp - prevWeekSp).toFloat() / prevWeekSp * 100f).toInt()
    } else 0
    val totalSp = points.last().cumulativeSp
    val avgWeeklyVelocity = if (points.isNotEmpty()) totalSp / points.size else 0
    val peakPoint = points.maxByOrNull { it.weeklySp } ?: points.last()

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("card_weekly_sp_trend"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            // Header with Icon & Tag
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(ZahiraGold.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.TrendingUp,
                            contentDescription = null,
                            tint = ZahiraMaroon,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Wednesday Quiz Marks & Progress Trend",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Track marks & Science Points (SP) earned in Wednesday quizzes",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = ZahiraMaroon.copy(alpha = 0.1f)
                ) {
                    Text(
                        text = "6 WEEKS",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = ZahiraMaroon,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Summary Metric Badges Strip
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetricMiniCard(
                    title = "Current Week",
                    value = "+$currentWeekSp SP",
                    subtitle = if (growthPercent >= 0) "▲ +$growthPercent%" else "▼ $growthPercent%",
                    subColor = if (growthPercent >= 0) Color(0xFF059669) else Color(0xFFDC2626),
                    modifier = Modifier.weight(1f)
                )
                MetricMiniCard(
                    title = "Avg Velocity",
                    value = "$avgWeeklyVelocity SP/wk",
                    subtitle = "Consistent",
                    subColor = ZahiraMaroon,
                    modifier = Modifier.weight(1f)
                )
                MetricMiniCard(
                    title = "Peak Week",
                    value = "${peakPoint.weeklySp} SP",
                    subtitle = peakPoint.shortLabel,
                    subColor = Color(0xFFD97706),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Subject Filter Chips
            val subjects = listOf("Overall", "Combined Mathematics", "Physics", "Chemistry", "Biology", "ICT")
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(subjects) { subject ->
                    val isSelected = selectedSubject == subject
                    val label = when (subject) {
                        "Overall" -> "🏆 Overall"
                        "Combined Mathematics" -> "📐 Maths"
                        "Physics" -> "⚛️ Physics"
                        "Chemistry" -> "🧪 Chemistry"
                        "Biology" -> "🧬 Biology"
                        "ICT" -> "💻 ICT"
                        else -> subject
                    }
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedSubject = subject },
                        label = { Text(label, fontSize = 11.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
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
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Metric Mode Toggle (Weekly Gain vs Cumulative)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFF1F5F9))
                    .padding(2.dp)
            ) {
                ChartMetricMode.entries.forEach { mode ->
                    val isSelected = metricMode == mode
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(6.dp)),
                        color = if (isSelected) Color.White else Color.Transparent,
                        shadowElevation = if (isSelected) 1.dp else 0.dp,
                        onClick = { metricMode = mode }
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = mode.label,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) ZahiraMaroon else TextSecondary
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Active Selected Point Detail Callout
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)),
                border = androidx.compose.foundation.BorderStroke(1.dp, ZahiraGold.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "${selectedPoint.weekLabel} • $selectedSubject",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF92400E)
                        )
                        Text(
                            text = if (selectedPoint.weekNumber == 1) {
                                "Starting Baseline: +${selectedPoint.weeklySp} SP"
                            } else {
                                "Improvement: +${selectedPoint.percentageGrowth.toInt()}% vs prior week"
                            },
                            fontSize = 11.sp,
                            color = Color(0xFF78350F)
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = ZahiraMaroon
                    ) {
                        Text(
                            text = if (metricMode == ChartMetricMode.WEEKLY_GAIN) "+${selectedPoint.weeklySp} SP" else "${selectedPoint.cumulativeSp} Total SP",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Native Jetpack Compose Canvas Chart
            val textMeasurer = rememberTextMeasurer()
            val animatedProgress by animateFloatAsState(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 650),
                label = "chartAnim"
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFFAFAFA))
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                    .pointerInput(points, metricMode) {
                        detectTapGestures { offset ->
                            val width = size.width
                            val paddingLeft = 45f
                            val paddingRight = 20f
                            val chartWidth = width - paddingLeft - paddingRight
                            val step = chartWidth / (points.size - 1).coerceAtLeast(1)
                            val relativeX = (offset.x - paddingLeft).coerceIn(0f, chartWidth)
                            val nearestIndex = ((relativeX / step) + 0.5f).toInt().coerceIn(0, points.lastIndex)
                            selectedPointIndex = nearestIndex
                        }
                    }
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height

                    val padLeft = 48f
                    val padRight = 24f
                    val padTop = 20f
                    val padBottom = 32f

                    val chartW = w - padLeft - padRight
                    val chartH = h - padTop - padBottom

                    val values = points.map {
                        if (metricMode == ChartMetricMode.WEEKLY_GAIN) it.weeklySp.toFloat() else it.cumulativeSp.toFloat()
                    }
                    val maxVal = ((values.maxOrNull() ?: 100f) * 1.25f).coerceAtLeast(40f)

                    // Draw horizontal dashed grid lines and Y-axis labels
                    val gridLines = 4
                    for (i in 0..gridLines) {
                        val fraction = i.toFloat() / gridLines
                        val y = padTop + chartH * (1f - fraction)
                        val spVal = (maxVal * fraction).toInt()

                        // Grid line
                        drawLine(
                            color = Color(0xFFE2E8F0),
                            start = Offset(padLeft, y),
                            end = Offset(w - padRight, y),
                            strokeWidth = 1f,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f), 0f)
                        )

                        // Y-axis text
                        drawText(
                            textMeasurer = textMeasurer,
                            text = "$spVal",
                            topLeft = Offset(4f, y - 8f),
                            style = TextStyle(
                                fontSize = 9.sp,
                                color = Color(0xFF94A3B8),
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                    }

                    // Compute point coordinates
                    val coords = points.mapIndexed { index, _ ->
                        val x = padLeft + (chartW / (points.size - 1).coerceAtLeast(1)) * index
                        val y = padTop + chartH * (1f - (values[index] / maxVal) * animatedProgress)
                        Offset(x, y)
                    }

                    // Draw Smooth Bezier Area Fill
                    if (coords.size >= 2) {
                        val areaPath = Path().apply {
                            moveTo(coords.first().x, padTop + chartH)
                            lineTo(coords.first().x, coords.first().y)
                            for (i in 0 until coords.size - 1) {
                                val p0 = coords[i]
                                val p1 = coords[i + 1]
                                val controlX1 = p0.x + (p1.x - p0.x) / 2f
                                val controlY1 = p0.y
                                val controlX2 = p0.x + (p1.x - p0.x) / 2f
                                val controlY2 = p1.y
                                cubicTo(controlX1, controlY1, controlX2, controlY2, p1.x, p1.y)
                            }
                            lineTo(coords.last().x, padTop + chartH)
                            close()
                        }

                        drawPath(
                            path = areaPath,
                            brush = Brush.verticalGradient(
                                colors = listOf(
                                    ZahiraGold.copy(alpha = 0.35f),
                                    ZahiraMaroon.copy(alpha = 0.03f)
                                ),
                                startY = padTop,
                                endY = padTop + chartH
                            )
                        )

                        // Draw Smooth Bezier Line Stroke
                        val linePath = Path().apply {
                            moveTo(coords.first().x, coords.first().y)
                            for (i in 0 until coords.size - 1) {
                                val p0 = coords[i]
                                val p1 = coords[i + 1]
                                val controlX1 = p0.x + (p1.x - p0.x) / 2f
                                val controlY1 = p0.y
                                val controlX2 = p0.x + (p1.x - p0.x) / 2f
                                val controlY2 = p1.y
                                cubicTo(controlX1, controlY1, controlX2, controlY2, p1.x, p1.y)
                            }
                        }

                        drawPath(
                            path = linePath,
                            color = ZahiraMaroon,
                            style = Stroke(width = 3.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                        )
                    }

                    // Draw data points & X-axis labels
                    coords.forEachIndexed { index, coord ->
                        val isSelected = index == selectedPointIndex

                        // Selected vertical highlight indicator
                        if (isSelected) {
                            drawLine(
                                color = ZahiraGold.copy(alpha = 0.8f),
                                start = Offset(coord.x, padTop),
                                end = Offset(coord.x, padTop + chartH),
                                strokeWidth = 2f,
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f), 0f)
                            )
                            // Outer glowing halo
                            drawCircle(
                                color = ZahiraGold.copy(alpha = 0.3f),
                                radius = 12f,
                                center = coord
                            )
                        }

                        // Marker dot
                        drawCircle(
                            color = if (isSelected) ZahiraMaroon else ZahiraGold,
                            radius = if (isSelected) 6f else 4.5f,
                            center = coord
                        )
                        drawCircle(
                            color = Color.White,
                            radius = if (isSelected) 3.5f else 2.5f,
                            center = coord
                        )

                        // X-axis label
                        val label = points[index].shortLabel
                        drawText(
                            textMeasurer = textMeasurer,
                            text = label,
                            topLeft = Offset(coord.x - 12f, padTop + chartH + 8f),
                            style = TextStyle(
                                fontSize = 10.sp,
                                color = if (isSelected) ZahiraMaroon else Color(0xFF64748B),
                                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Actionable Improvement Guidance
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Insights,
                        contentDescription = null,
                        tint = ZahiraGold,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Growth Trajectory Analysis",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Your SP growth is accelerating at +$growthPercent% over previous weeks. Keep practicing $selectedSubject to maintain rank and earn milestone rewards!",
                            fontSize = 10.sp,
                            color = TextSecondary,
                            lineHeight = 14.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricMiniCard(
    title: String,
    value: String,
    subtitle: String,
    subColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(text = title, fontSize = 10.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
            Spacer(modifier = Modifier.height(1.dp))
            Text(text = subtitle, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = subColor)
        }
    }
}
