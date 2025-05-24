class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        this.player = {
            x: 100,
            y: this.canvas.height - 150,
            radius: 20,
            hammerLength: 100,
            hammerAngle: 0,
            velocity: { x: 0, y: 0 },
            isGrounded: false,
            isHooked: false,
            hookPoint: { x: 0, y: 0 },
            isSwinging: false,
            swingVelocity: 0,
            canJump: true,
            jumpForce: -15,
            moveSpeed: 5,
            wallGrab: false,
            wallDirection: 0,
            hammerWidth: 15,
            lastMouseX: 0,
            lastMouseY: 0,
            isDangling: false
        };
        
        this.obstacles = [];
        this.height = 0;
        this.time = 0;
        this.gameStarted = false;
        this.lastTime = 0;
        this.gameOver = false;
        
        this.setupEventListeners();
        this.generateObstacles();
        this.showMenu();
        this.animate();
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }
    
    setupEventListeners() {
        // 키보드 입력 처리
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted) return;
            
            switch(e.code) {
                case 'Space':
                    if (this.gameOver) {
                        this.restartGame();
                    } else if (this.player.isGrounded || this.player.isDangling) {
                        this.player.velocity.y = this.player.jumpForce;
                        this.player.canJump = false;
                        this.player.isDangling = false;
                    }
                    break;
                // 좌우 이동 제거
                // case 'KeyA':
                // case 'ArrowLeft':
                //     this.player.velocity.x = -this.player.moveSpeed;
                //     break;
                // case 'KeyD':
                // case 'ArrowRight':
                //     this.player.velocity.x = this.player.moveSpeed;
                //     break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (!this.gameStarted) return;
            
            switch(e.code) {
                 // 좌우 이동 제거
                // case 'KeyA':
                // case 'ArrowLeft':
                // case 'KeyD':
                // case 'ArrowRight':
                //     this.player.velocity.x = 0;
                //     break;
            }
        });
        
        // 마우스 입력 처리
        document.addEventListener('mousemove', (e) => {
            if (!this.gameStarted) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.player.hammerAngle = Math.atan2(
                mouseY - this.player.y,
                mouseX - this.player.x
            );
            
            // 마우스 움직임에 따른 플레이어 이동 (망치 걸렸을 때)
            if (this.player.isHooked) {
                const mouseDeltaX = mouseX - this.player.lastMouseX;
                const mouseDeltaY = mouseY - this.player.lastMouseY;
                
                // 마우스 수평 이동에 비례하여 플레이어에게 힘 적용 (지형 드래그 시 유용)
                const moveForceX = mouseDeltaX * 0.5; // 수평 힘 크기 조절
                this.player.velocity.x += moveForceX;

                // 마우스 수직 이동에 비례하여 플레이어에게 힘 적용 (공중 스윙 시 유용)
                const moveForceY = mouseDeltaY * 0.5; // 수직 힘 크기 조절
                // 이 힘은 update 함수에서 isDraggingOnTerrain 상태에 따라 다르게 적용할 수 있음
                // 현재는 velocity에 직접 더하지만, 추후 update에서 분리하여 처리 고려
                 this.player.velocity.y += moveForceY;

            }
            
            this.player.lastMouseX = mouseX; // 현재 마우스 X 좌표 저장
            this.player.lastMouseY = mouseY; // 현재 마우스 Y 좌표 저장
        });
        
        document.addEventListener('mousedown', (e) => {
            if (!this.gameStarted) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const hammerBaseX = this.player.x;
            const hammerBaseY = this.player.y;
            const hammerEndX = hammerBaseX + Math.cos(this.player.hammerAngle) * this.player.hammerLength;
            const hammerEndY = hammerBaseY + Math.sin(this.player.hammerAngle) * this.player.hammerLength;
            
            // 망치 끝과 지형 충돌 체크
            for (const obstacle of this.obstacles) {
                // 망치 선분과 장애물 사각형의 교차점 찾기
                const intersectionPoint = this.getLineRectangleIntersectionPoint(
                    { x: hammerBaseX, y: hammerBaseY },
                    { x: hammerEndX, y: hammerEndY },
                    obstacle
                );
                
                if (intersectionPoint) {
                    
                    // 충돌 지점이 망치 끝에서 가까운 특정 범위 내에 있으면 매달림 상태로 전환
                    // 교차점과 망치 끝점 사이의 거리 계산
                    const distanceToIntersection = Math.sqrt(
                         (hammerEndX - intersectionPoint.x)**2 +
                         (hammerEndY - intersectionPoint.y)**2
                    );
                    
                    const dangleThreshold = 30; // 매달림/걸림 판정 거리 임계값 (조절 가능)

                    // 교차점이 망치 끝에서 임계값 이내에 있으면 매달림, 아니면 걸림
                    if (distanceToIntersection < dangleThreshold) {
                         this.player.isDangling = true;
                         this.player.hookPoint = intersectionPoint; // 정확한 교차점을 hookPoint로 설정
                         this.player.isHooked = false; // 기존 걸림 상태 해제
                         this.player.isSwinging = false; // 스윙 상태 해제
                         this.player.velocity = { x: 0, y: 0 }; // 속도 리셋
                    } else { // 교차점이 망치 끝에서 멀리 있으면 걸림 상태로 전환
                         this.player.isHooked = true;
                         this.player.hookPoint = intersectionPoint; // 정확한 교차점을 hookPoint로 설정
                         this.player.isSwinging = true;
                         this.player.isDangling = false; // 매달림 상태 해제
                         this.player.velocity = { x: 0, y: 0 }; // 속도 리셋
                     }
                     
                     this.player.lastMouseX = mouseX; // 망치 걸리는 순간의 마우스 X 좌표 저장
                     // 첫 번째 충돌한 장애물에 대해서만 처리하고 함수 종료
                     return;
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.player.isHooked = false;
            this.player.isSwinging = false;
            this.player.isDangling = false;
            this.player.swingVelocity = 0;
        });
        
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restartButton').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.getElementById('quitButton').addEventListener('click', () => {
            this.showMenu();
        });
    }
    
    generateObstacles() {
        this.obstacles = [];
        let currentY = this.canvas.height - 100;
        
        this.obstacles.push({
            x: 50,
            y: this.canvas.height - 100,
            width: 200,
            height: 20
        });
        
        while (currentY > 0) {
            const width = Math.random() * 200 + 100;
            const height = Math.random() * 50 + 20;
            const x = Math.random() * (this.canvas.width - width);
            
            this.obstacles.push({
                x,
                y: currentY,
                width,
                height
            });
            
            currentY -= height + Math.random() * 100 + 50;
        }
    }
    
    // 선분-사각형 충돌 감지 헬퍼 함수
    lineIntersectsRect(p1, p2, rect) {
        const { x, y, width, height } = rect;
        
        // 사각형의 네 변
        const sides = [
            { p1: { x: x, y: y }, p2: { x: x + width, y: y } }, // 상단
            { p1: { x: x + width, y: y }, p2: { x: x + width, y: y + height } }, // 우측
            { p1: { x: x + width, y: y + height }, p2: { x: x, y: y + height } }, // 하단
            { p1: { x: x, y: y + height }, p2: { x: x, y: y } } // 좌측
        ];
        
        for (const side of sides) {
            if (this.lineSegmentsIntersect(p1, p2, side.p1, side.p2)) {
                return true;
            }
        }
        return false;
    }
    
    // 두 선분 교차점 감지 헬퍼 함수 (https://editor.p5js.org/jht9629-nyu/sketches/gZpL8b-c0 참고)
    lineSegmentsIntersect(p1, p2, p3, p4) {
        // p1 = {x1, y1}, p2 = {x2, y2}, p3 = {x3, y3}, p4 = {x4, y4}
        const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

        const denominator = ((x2 - x1) * (y4 - y3)) - ((y2 - y1) * (x4 - x3));

        if (denominator === 0) {
            return null; // 평행하거나 같은 선상에 있음, 교차점 없음
        }

        const numerator1 = ((y1 - y3) * (x4 - x3)) - ((x1 - x3) * (y4 - y3));
        const numerator2 = ((y1 - y3) * (x2 - x1)) - ((x1 - x3) * (y2 - y1));

        const t1 = numerator1 / denominator;
        const t2 = numerator2 / denominator;

        // 두 선분이 서로의 범위 내에서 교차하는지 확인
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            // 교차점 계산
            const intersectX = x1 + t1 * (x2 - x1);
            const intersectY = y1 + t1 * (y2 - y1);
            return { x: intersectX, y: intersectY };
        }

        return null; // 교차하지 않음
    }
    
    // 선분-사각형 교차점 감지 헬퍼 함수
    getLineRectangleIntersectionPoint(p1, p2, rect) {
        const { x, y, width, height } = rect;
        
        // 사각형의 네 변
        const sides = [
            { p1: { x: x, y: y }, p2: { x: x + width, y: y } }, // 상단
            { p1: { x: x + width, y: y }, p2: { x: x + width, y: y + height } }, // 우측
            { p1: { x: x + width, y: y + height }, p2: { x: x, y: y + height } }, // 하단
            { p1: { x: x, y: y + height }, p2: { x: x, y: y } } // 좌측
        ];
        
        for (const side of sides) {
            const intersection = this.lineSegmentsIntersect(p1, p2, side.p1, side.p2);
            if (intersection) {
                return intersection; // 첫 번째 교차점 반환
            }
        }
        return null; // 교차점 없음
    }
    
    update() {
        if (!this.gameStarted) return;
        
        this.checkWallGrab();
        
        // 현재 마우스 위치 가져오기 (이전 프레임의 마지막 마우스 X 사용)
        const mouseX = this.player.lastMouseX; // mousemove에서 업데이트된 마지막 마우스 X
        // const mouseY = ?; // 현재 mouseY는 update 함수 내에서 바로 사용되지 않음

        // 망치 끝의 현재 위치 계산
        const hammerBaseX = this.player.x;
        const hammerBaseY = this.player.y;
        const hammerEndX = hammerBaseX + Math.cos(this.player.hammerAngle) * this.player.hammerLength;
        const hammerEndY = hammerBaseY + Math.sin(this.player.hammerAngle) * this.player.hammerLength;

        let isDraggingOnTerrain = false;
        let surfaceNormal = { x: 0, y: 0 }; // 지형 표면의 법선 벡터 (이동 방향 결정에 사용될 수 있음)

        // 망치 끝이 지형과 접촉하고 있는지 지속적으로 확인
        if (this.player.isHooked || this.player.isDangling) {
             for (const obstacle of this.obstacles) {
                  const intersectionPoint = this.getLineRectangleIntersectionPoint(
                      { x: hammerBaseX, y: hammerBaseY },
                      { x: hammerEndX, y: hammerEndY },
                      obstacle
                  );
                  if (intersectionPoint) {
                       // 망치 끝이 장애물과 접촉 중이라고 판단
                       isDraggingOnTerrain = true;
                       // TODO: 지형 표면의 법선 벡터 계산 로직 추가 (어떤 변에 충돌했는지 판단하여 방향 설정)
                       // 임시로 수평면 가정 (벽타기와 구분 필요)
                       surfaceNormal = { x: 0, y: -1 }; // 예를 들어, 바닥에 접촉 시 법선은 위쪽
                       break; // 첫 번째 접촉한 장애물만 고려
                  }
             }
        }

        if (this.player.isHooked && this.player.isSwinging) {
            const dx = this.player.x - this.player.hookPoint.x;
            const dy = this.player.y - this.player.hookPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // 망치 걸린 상태에서의 이동 계산
            // mousemove에서 마우스 움직임에 따라 velocity.x와 velocity.y에 힘이 가해지고 있음
            
            if (!isDraggingOnTerrain) {
                 // 공중 스윙 중일 때: 걸린 지점 중심으로 원운동을 유지하고 마우스 수직 움직임으로 추진력 조절
                 const targetX = this.player.hookPoint.x + Math.cos(angle) * this.player.hammerLength;
                 const targetY = this.player.hookPoint.y + Math.sin(angle) * this.player.hammerLength;
                 
                 const moveForceMagnitude = 0.5; // 원운동 유지 힘 조절
                 this.player.velocity.x += (targetX - this.player.x) * moveForceMagnitude;
                 // this.player.velocity.y += (targetY - this.player.y) * moveForceMagnitude; // 수직 원운동 유지는 마우스 움직임과 결합

                 // 마우스 수직 움직임(mousemove에서 velocity.y에 이미 반영됨)을 이용한 추진력
                 // velocity.y에 이미 더해진 값을 사용하거나, 여기서 다시 계산하여 추가
                 // 여기서는 이미 더해진 velocity.y를 기반으로 추가적인 조정을 할 수 있음
                 // 예: 위로 마우스 이동 시(velocity.y < 0) 중력 상쇄 또는 추가 상승 힘 적용
                 // 현재는 mousemove에서 직접 velocity.y에 더하는 것으로 충분할 수 있음.
                 // 만약 더 미세한 조절이 필요하다면 여기에 로직 추가.

            } else {
                 // 지형 드래그 중일 때: 지형 표면을 따라 이동 (mousemove에서 수평 속도 이미 적용됨)
                 // TODO: 지형 경사에 따라 수직 이동도 자연스럽게 발생하도록 velocity.y 조정
                 // 현재는 mousemove에서 가해진 수평/수직 속도와 마찰력으로 이동
                 // 필요하다면 여기에 지형 법선 벡터를 이용한 이동 로직 추가
            }

        } else if (this.player.isDangling) {
            // 중력 적용
            this.player.velocity.y += 0.5;
            // 매달린 지점에서 너무 멀리 떨어지지 않도록 제약 (드래그 중이 아닐 때)
            if (!isDraggingOnTerrain) {
                 const dx = this.player.x - this.player.hookPoint.x;
                 const dy = this.player.y - this.player.hookPoint.y;
                 const distance = Math.sqrt(dx * dx + dy * dy);
                 const maxDangleDistance = this.player.hammerLength + 10; // 매달릴 수 있는 최대 거리
                 
                 if (distance > maxDangleDistance) {
                      const angle = Math.atan2(dy, dx);
                      this.player.x = this.player.hookPoint.x + Math.cos(angle) * maxDangleDistance;
                      this.player.y = this.player.hookPoint.y + Math.sin(angle) * maxDangleDistance;
                      // 속도 방향을 걸린 지점 중심으로 재조정
                      const velocityMagnitude = Math.sqrt(this.player.velocity.x**2 + this.player.velocity.y**2);
                      const velocityAngle = Math.atan2(this.player.velocity.y, this.player.velocity.x);
                      const angleDiff = velocityAngle - angle;
                      // 원형 움직임에 맞는 속도 성분만 유지
                      const tangentialVelocity = velocityMagnitude * Math.sin(angleDiff);
                      this.player.velocity.x = Math.cos(angle + Math.PI / 2) * tangentialVelocity; // 접선 방향
                      this.player.velocity.y = Math.sin(angle + Math.PI / 2) * tangentialVelocity;
                 }
            } else {
                  // 지형 드래그 중일 때
                  // mousemove에서 이미 velocity.x와 velocity.y에 힘이 가해졌으므로 추가적인 중력이나 제약 불필요
                  // TODO: 지형 표면을 따라 미끄러지는 효과 등을 추가할 수 있음
            }

        } else if (this.player.wallGrab) {
            this.player.velocity.y = 0;
            this.player.canJump = true;
        } else {
            this.player.velocity.y += 0.5; // 중력
            // 바닥 근처에서 부양 효과 추가
            if (this.player.y + this.player.radius > this.canvas.height - 100) {
                 const buoyancy = (this.canvas.height - 100 - (this.player.y + this.player.radius)) * 0.1;
                 this.player.velocity.y -= buoyancy;
            }
        }
        
        // 충돌 체크 (플레이어 본체 및 망치)
        // 망치-장애물 충돌 물리 반응은 isHooked/isDangling 상태가 아닐 때만 적용되어야 함
        if (!this.player.isHooked && !this.player.isDangling) {
             this.checkCollisions();
        }
        
        this.player.x += this.player.velocity.x;
        this.player.y += this.player.velocity.y;
        
        // 마찰력 (상태에 따라 다르게 적용)
        if (this.player.isHooked && this.player.isSwinging) {
             if (isDraggingOnTerrain) {
                  this.player.velocity.x *= 0.9; // 지형 드래그 중 수평 마찰
                  this.player.velocity.y *= 0.9; // 지형 드래그 중 수직 마찰
             } else {
                  this.player.velocity.x *= 0.99; 
                  this.player.velocity.y *= 0.99;
             }
        } else if (this.player.isDangling) {
             if (isDraggingOnTerrain) {
                   this.player.velocity.x *= 0.9; // 지형 드래그 중 수평 마찰
                   this.player.velocity.y *= 0.9; // 지형 드래그 중 수직 마찰
             } else {
                  this.player.velocity.x *= 0.98;
                  this.player.velocity.y *= 0.98;
             }
        } else if (this.player.wallGrab) {
             // 벽 타기 상태에서는 별도 마찰력 적용 없을 수 있음
        } else {
             this.player.velocity.x *= 0.95;
             this.player.velocity.y *= 0.95;
        }

        if (this.player.y + this.player.radius > this.canvas.height) {
             this.gameOver = true;
             this.showGameOver();
             return; // 게임 오버 시 업데이트 중단
        }

        this.height = Math.max(this.height, this.canvas.height - this.player.y);
        document.getElementById('height').textContent = `Height: ${Math.floor(this.height)}m`;
        this.time += 1/60;
        document.getElementById('time').textContent = `Time: ${Math.floor(this.time)}s`;
    }
    
    checkCollisions() {
        this.player.isGrounded = false;
        
        const hammerStartX = this.player.x;
        const hammerStartY = this.player.y;
        const hammerEndX = this.player.x + Math.cos(this.player.hammerAngle) * this.player.hammerLength;
        const hammerEndY = this.player.y + Math.sin(this.player.hammerAngle) * this.player.hammerLength;

        for (const obstacle of this.obstacles) {
            // 플레이어 본체와 장애물 충돌 (간단한 AABB 충돌)
            if (this.player.x - this.player.radius < obstacle.x + obstacle.width &&
                this.player.x + this.player.radius > obstacle.x &&
                this.player.y - this.player.radius < obstacle.y + obstacle.height &&
                this.player.y + this.player.radius > obstacle.y) {
                
                // TODO: 플레이어 본체와 장애물 충돌 시 물리적 반응 추가 (밀려나거나 멈추는 등)
                // 현재는 기본적인 바닥 충돌만 처리 (시작 플랫폼) 이곳에 플레이어 본체 충돌시 처리 로직 추가 고려
                if (this.player.y + this.player.radius > obstacle.y && this.player.y - this.player.radius < obstacle.y) { // 위에서 아래로 충돌
                     this.player.y = obstacle.y - this.player.radius;
                     this.player.velocity.y = 0;
                     this.player.isGrounded = true;
                     this.player.canJump = true;
                } else if (this.player.y - this.player.radius < obstacle.y + obstacle.height && this.player.y + this.player.radius > obstacle.y + obstacle.height) { // 아래에서 위로 충돌
                     this.player.y = obstacle.y + obstacle.height + this.player.radius;
                     this.player.velocity.y = 0;
                }
                
                // 좌우 충돌 처리는 벽 타기에서 부분적으로 처리됨 이곳에 좌우 충돌 처리 로직 추가 고려
            }

            // 망치와 장애물 충돌 체크 (망치 선분과 사각형)
            if (!this.player.isHooked && // 망치 걸기 상태가 아닐 때만 물리적 상호작용
                this.lineIntersectsRect(
                    { x: hammerStartX, y: hammerStartY },
                    { x: hammerEndX, y: hammerEndY },
                    obstacle
                )) {
                
                 // 망치 충돌 시 플레이어에게 힘 적용
                 const angleFromPlayerToObstacle = Math.atan2( (obstacle.y + obstacle.height/2) - this.player.y, (obstacle.x + obstacle.width/2) - this.player.x);
                 // const hammerObstacleAngleDiff = Math.abs(this.player.hammerAngle - angleFromPlayerToObstacle); // 사용하지 않으므로 제거 또는 주석 처리

                 let forceMagnitude = 2; // 기본 힘 크기 다시 조정 (3 -> 2)
                 let forceAngle = this.player.hammerAngle + Math.PI; // 기본적으로 망치 방향의 반대로 밀림

                 // 이미지를 기반으로 특정 상황에 오른쪽으로 강하게 미는 로직 추가
                 // 망치 끝이 장애물의 왼쪽에 있고, 망치가 아래-오른쪽을 향할 때
                 if (hammerEndX < obstacle.x + obstacle.width/2 && // 망치 끝이 장애물 중심의 왼쪽에 있고
                     this.player.hammerAngle > 0 && this.player.hammerAngle < Math.PI / 2) { // 망치가 대략 아래-오른쪽을 향할 때 (0도에서 90도 사이)

                      forceAngle = 0; // 오른쪽 방향
                      forceMagnitude = 8; // 강한 힘 적용 조정 (10 -> 8)
                      
                 } else if (this.player.hammerAngle > 0 && this.player.hammerAngle < Math.PI) { // 망치 각도가 아래쪽을 향할 때 (일반 찍기)
                      // 장애물이 플레이어보다 아래쪽에 있으면 (찍어 누르는 상황)
                      if (obstacle.y + obstacle.height > this.player.y) {
                           forceAngle = -Math.PI / 2; // 위쪽으로 힘
                           forceMagnitude = 3; // 위쪽 힘 감소 (4 -> 3)
                      }
                 }
                 
                 // 망치 속도에 비례하여 힘을 더 강하게
                 const currentVelocity = Math.sqrt(this.player.velocity.x * this.player.velocity.x + this.player.velocity.y * this.player.velocity.y);
                 forceMagnitude += currentVelocity * 0.03; // 속도 비례 힘 감소 (0.05 -> 0.03)

                 this.player.velocity.x += Math.cos(forceAngle) * forceMagnitude;
                 this.player.velocity.y += Math.sin(forceAngle) * forceMagnitude;
            }
        }
        
        // TODO: 모든 obstacle에 대한 정확한 바닥 충돌 처리 필요 (현재는 시작 플랫폼 기준 임시 처리)
        
        // 화면 경계에서의 바닥 충돌 (완전히 떨어지는 것과 구분)
        // 이 로직은 checkCollisions 외부 또는 다른 곳으로 이동하는 것이 더 적절할 수 있습니다.
        // if (this.player.y + this.player.radius > this.canvas.height) {
        //      this.player.y = this.canvas.height - this.player.radius;
        //      this.player.velocity.y = 0;
        //      this.player.isGrounded = true;
        //      this.player.canJump = true;
        // }
    }
    
    checkWallGrab() {
        this.player.wallGrab = false;
        this.player.wallDirection = 0;
        
        for (const obstacle of this.obstacles) {
            // 왼쪽 벽 체크
            if (Math.abs(this.player.x - (obstacle.x + obstacle.width)) < this.player.radius &&
                this.player.y + this.player.radius > obstacle.y &&
                this.player.y - this.player.radius < obstacle.y + obstacle.height) {
                this.player.wallGrab = true;
                this.player.wallDirection = -1;
                this.player.velocity.x = 0; // 벽에 붙었을 때 x 속도 0
                this.player.x = obstacle.x + obstacle.width + this.player.radius; // 벽에 완전히 붙도록 위치 조정
                return;
            }
            // 오른쪽 벽 체크
            if (Math.abs(this.player.x - obstacle.x) < this.player.radius &&
                this.player.y + this.player.radius > obstacle.y &&
                this.player.y - this.player.radius < obstacle.y + obstacle.height) {
                this.player.wallGrab = true;
                this.player.wallDirection = 1;
                this.player.velocity.x = 0; // 벽에 붙었을 때 x 속도 0
                this.player.x = obstacle.x - this.player.radius; // 벽에 완전히 붙도록 위치 조정
                return;
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#8B4513';
        for (const obstacle of this.obstacles) {
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
        
        // 플레이어 눈사람 그리기
        const bodyRadius = this.player.radius;
        const headRadius = this.player.radius * 0.7;
        const bodyY = this.player.y;
        const headY = this.player.y - bodyRadius - headRadius * 0.8;
        
        // 눈사람 몸통
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, bodyY, bodyRadius, 0, Math.PI * 2);
        // 상태에 따른 색상 적용
        if (this.player.wallGrab) {
             this.ctx.fillStyle = '#00FF00'; // 초록색 (벽 잡기)
        } else if (this.player.isDangling) {
             this.ctx.fillStyle = '#FFFF00'; // 노란색 (매달림)
        } else {
             this.ctx.fillStyle = '#FFFFFF'; // 흰색 (기본)
        }
        this.ctx.fill();
        
        // 눈사람 머리
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, headY, headRadius, 0, Math.PI * 2);
         if (this.player.wallGrab) {
             this.ctx.fillStyle = '#00FF00'; // 초록색 (벽 잡기)
        } else if (this.player.isDangling) {
             this.ctx.fillStyle = '#FFFF00'; // 노란색 (매달림)
        } else {
             this.ctx.fillStyle = '#FFFFFF'; // 흰색 (기본)
        }
        this.ctx.fill();
        
        // 중절모 그리기
        const hatWidth = headRadius * 1.8;
        const hatHeight = headRadius * 0.8;
        const brimHeight = hatHeight * 0.3;
        const crownHeight = hatHeight - brimHeight;
        const hatX = this.player.x - hatWidth / 2;
        const brimY = headY - headRadius * 0.8 - brimHeight; // 머리 위쪽에 위치
        const crownY = brimY - crownHeight;

        // 모자 챙
        this.ctx.fillStyle = '#333333'; // 모자 색상 (어두운 회색)
        this.ctx.fillRect(hatX, brimY, hatWidth, brimHeight);
        
        // 모자 크라운
        const crownWidth = hatWidth * 0.6;
        const crownX = this.player.x - crownWidth / 2;
        this.ctx.fillRect(crownX, crownY, crownWidth, crownHeight);

        const hammerBaseX = this.player.x;
        const hammerBaseY = this.player.y;
        const hammerEndX = hammerBaseX + Math.cos(this.player.hammerAngle) * this.player.hammerLength;
        const hammerEndY = hammerBaseY + Math.sin(this.player.hammerAngle) * this.player.hammerLength;
        
        this.ctx.beginPath();
        this.ctx.moveTo(hammerBaseX, hammerBaseY);
        this.ctx.lineTo(hammerEndX, hammerEndY);
        if (this.player.isHooked) {
            this.ctx.strokeStyle = '#FF0000';
        } else if (this.player.isDangling) {
             this.ctx.strokeStyle = '#FFFF00';
        } else {
             this.ctx.strokeStyle = '#000000';
        }
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        const headSize = 20;
        const angle = this.player.hammerAngle;
        
        this.ctx.save();
        this.ctx.translate(hammerEndX, hammerEndY);
        this.ctx.rotate(angle);
        
        this.ctx.fillStyle = '#5A5A5A';
        this.ctx.fillRect(-headSize / 2, -headSize / 2, headSize, headSize);
        
        this.ctx.restore();

        if (this.player.isHooked || this.player.isDangling) {
            this.ctx.beginPath();
            this.ctx.arc(this.player.hookPoint.x, this.player.hookPoint.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = this.player.isDangling ? '#FFFF00' : '#0000FF';
            this.ctx.fill();
        }
    }
    
    animate(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update();
        this.draw();
        requestAnimationFrame((time) => this.animate(time));
    }
    
    startGame() {
        this.gameStarted = true;
        this.gameOver = false;
        document.getElementById('menu').style.display = 'none';
        this.player.x = 100;
        this.player.y = this.canvas.height - 150;
        this.player.velocity = { x: 0, y: 0 };
        this.height = 0;
        this.time = 0;
        this.player.lastMouseX = 0;
        this.player.lastMouseY = 0;
    }
    
    restartGame() {
        this.generateObstacles();
        this.startGame();
    }
    
    showMenu() {
        this.gameStarted = false;
        this.gameOver = false;
        const menu = document.getElementById('menu');
        menu.style.display = 'block';
        menu.innerHTML = `
            <h2>Pot Climbing Game</h2>
            <button id="startButton">Start Game</button>
            <button id="quitButton">Quit</button>
        `;
        
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('quitButton').addEventListener('click', () => {
            this.showMenu();
        });
    }
    
    showGameOver() {
        const menu = document.getElementById('menu');
        menu.style.display = 'block';
        menu.innerHTML = `
            <h2>Game Over</h2>
            <p>Height: ${Math.floor(this.height)}m</p>
            <p>Time: ${Math.floor(this.time)}s</p>
            <p>Press SPACE to try again</p>
            <button id="quitButton">Quit</button>
        `;
        
        document.getElementById('quitButton').addEventListener('click', () => {
            this.showMenu();
        });
    }
}

// Start the game
window.onload = () => {
    new Game();
}; 