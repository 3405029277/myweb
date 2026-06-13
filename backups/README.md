# 备份使用指南

## 快速使用

### 每次改动前执行：
```bash
./backup-before-change.sh "你要做的改动描述"
```

**示例：**
```bash
./backup-before-change.sh "修改首页 banner 样式"
./backup-before-change.sh "重构留言板布局"
./backup-before-change.sh "更新音乐播放器配置"
```

## 备份内容

每次备份会创建：
1. **Git stash** - 暂存当前所有修改（含未追踪文件）
2. **物理副本** - `backups/backup-YYYYMMDD-HHMMSS/` 目录

## 恢复方法

### 方法 1：从 Git stash 恢复（推荐）
```bash
# 查看所有备份
git stash list

# 恢复最新备份（不删除）
git stash apply stash@{0}

# 恢复指定备份
git stash apply stash@{2}

# 恢复并删除 stash
git stash pop stash@{0}
```

### 方法 2：从物理备份恢复
```bash
# 查看所有物理备份
ls -lh backups/

# 复制整个备份
cp -r backups/backup-20260612-143025/* .

# 或只复制某个文件
cp backups/backup-20260612-143025/index.html .
```

### 方法 3：查看备份日志
```bash
cat backups/backup-log.txt
```

## 注意事项

⚠️ **物理备份会占用磁盘空间**
- 定期清理旧备份：`rm -rf backups/backup-2026*`
- 保留近期 5-10 个备份即可

⚠️ **Git stash 数量建议**
- 超过 20 个 stash 时考虑清理
- 清理命令：`git stash drop stash@{10}`

✅ **最佳实践**
- 大改前必备份
- 备份描述要清晰
- 测试通过后 commit，然后删除对应备份
