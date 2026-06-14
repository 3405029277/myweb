#!/bin/bash
# 自动备份脚本 - 在每次修改前执行
# 用法: ./backup-before-change.sh "描述你要做的改动"

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DESCRIPTION="${1:-未指定描述}"

echo "🔄 开始备份当前工作..."

# 1. Git stash 暂存（带描述和时间戳）
echo "📦 Git stash 暂存..."
git add -A
git stash push -m "BACKUP-$TIMESTAMP: $DESCRIPTION"

# 2. 创建物理备份副本
BACKUP_DIR="backups/backup-$TIMESTAMP"
echo "💾 创建物理备份到 $BACKUP_DIR ..."
mkdir -p "$BACKUP_DIR"

# 复制关键文件
cp *.html "$BACKUP_DIR/" 2>/dev/null || true
cp -r assets "$BACKUP_DIR/" 2>/dev/null || true
cp -r posts "$BACKUP_DIR/" 2>/dev/null || true
cp -r scripts "$BACKUP_DIR/" 2>/dev/null || true
cp *.js "$BACKUP_DIR/" 2>/dev/null || true
cp package*.json "$BACKUP_DIR/" 2>/dev/null || true

# 3. 立即恢复工作区（保持当前状态）
echo "♻️  恢复工作区..."
git stash pop

# 4. 记录备份日志
echo "$TIMESTAMP | $DESCRIPTION | stash + $BACKUP_DIR" >> backups/backup-log.txt

echo "✅ 备份完成！"
echo ""
echo "📝 备份信息："
echo "   - Git stash: BACKUP-$TIMESTAMP"
echo "   - 物理备份: $BACKUP_DIR"
echo "   - 描述: $DESCRIPTION"
echo ""
echo "🔙 恢复方法："
echo "   git stash list  # 查看所有备份"
echo "   git stash apply stash@{0}  # 恢复最新备份"
echo "   或者直接从 $BACKUP_DIR 复制文件"
