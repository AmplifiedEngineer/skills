# gh api calls for PR comments

Set `OWNER`, `REPO`, `PR` and `ME` first. `gh pr view --json number,url,headRefOid` gives the number and head commit for the current branch. `gh repo view --json owner,name` gives the owner and repo. `gh api user --jq .login` gives your login.

## List the review threads

Inline review threads, with resolved state, line, and every comment. `--paginate` follows `$endCursor` for you.

```
gh api graphql --paginate \
  -f owner="$OWNER" -f name="$REPO" -F number="$PR" \
  -f query='
query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid
      author { login }
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          originalLine
          comments(first: 50) {
            nodes { databaseId author { login } body url createdAt }
          }
        }
      }
    }
  }
}'
```

Use `isResolved`, `isOutdated`, `path` and `line` to filter. `id` is the thread id (`PRRT_...`). The first comment's `databaseId` is the id for a REST reply. A thread with more than 50 comments is cut off, so say so if you see 50.

## List the PR-level comments

Comments on the conversation tab, with no path or line.

```
gh api --paginate "repos/$OWNER/$REPO/issues/$PR/comments" \
  --jq '.[] | {id, user: .user.login, body, html_url, created_at}'
```

Review bodies (the text a reviewer writes when submitting a review) are separate:

```
gh api --paginate "repos/$OWNER/$REPO/pulls/$PR/reviews" \
  --jq '.[] | select(.body != "") | {id, user: .user.login, state, body, html_url}'
```

## Reply in a review thread

Write the text to a file first, then post it verbatim. `-F body=@file` reads the file, so quotes and newlines survive.

```
mkdir -p .ae
printf '%s\n' 'Fixed.' > .ae/pr-comments-reply.md
gh api -X POST "repos/$OWNER/$REPO/pulls/$PR/comments/$COMMENT_ID/replies" \
  -F body=@.ae/pr-comments-reply.md --jq .html_url
```

`COMMENT_ID` is the `databaseId` of the first comment in the thread. The call prints the URL of the new reply.

Same reply through GraphQL, using the thread id:

```
gh api graphql -f threadId="$THREAD_ID" -F body=@.ae/pr-comments-reply.md -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
    comment { url }
  }
}'
```

## Reply to a PR-level comment

There is no thread. Post a new comment on the PR, starting with a blockquote of the comment you answer.

```
gh api -X POST "repos/$OWNER/$REPO/issues/$PR/comments" \
  -F body=@.ae/pr-comments-reply.md --jq .html_url
```

## Resolve a thread

The skill does not do this. Resolving is the reviewer's call. Run it only when the user asks for it by name, for a thread they pick.

```
gh api graphql -f threadId="$THREAD_ID" -f query='
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread { id isResolved }
  }
}'
```

## Check before you post

- Read the file back and confirm it holds only the reply text.
- Check for a dash, a curly quote, a commit hash and AI attribution. Fix them before the call.
- Delete the file under `.ae/` after the post if you made it only for this reply.

## Notes

- `gh api` needs a token with `repo` scope to reply. A 403 or 404 on a reply means the token lacks access or the comment was deleted.
