// js/core/singleplayer_compat.js
(function() {
    window.TacticalShooter = window.TacticalShooter || {};

    const localPlayerState = {
        id: "local",
        name: "Player",
        team: "SURVIVAL",
        kills: 0,
        deaths: 0,
        score: 0,
        streak: 0,
        health: 100,
        maxHealth: 100,
        status: "ALIVE"
    };

    // 1. PlayroomManager Stub
    const PlayroomManager = {
        roomCode: "OFFLINE_SANDBOX",
        myPlayer: {
            id: "local",
            name: "Player",
            team: "SURVIVAL",
            getState(key) {
                return localPlayerState[key];
            },
            setState(key, value, isPublic) {
                localPlayerState[key] = value;
            }
        },
        localPlayerName: "Player",
        lobbyPlayers: [],
        init() {},
        createRoom() { return Promise.resolve(); },
        joinRoom() { return Promise.resolve(); },
        disconnect() {},
        isHost: true,
        update(dt) {},
        broadcastBulletHit() {},
        onPlayerFired() {}
    };

    // 2. Playroom Global Stub
    const playroomGlobalState = {};
    window.Playroom = {
        getState(key) {
            return playroomGlobalState[key];
        },
        setState(key, value, isPublic) {
            playroomGlobalState[key] = value;
        }
    };

    // 3. RemotePlayerManager Stub
    const RemotePlayerManager = {
        remotePlayers: {},
        getHitboxes() { 
            if (window.TacticalShooter.WaveManager && window.TacticalShooter.WaveManager.activeEnemies) {
                const boxes = [];
                const enemies = window.TacticalShooter.WaveManager.activeEnemies;
                for (let i = 0; i < enemies.length; i++) {
                    const enemy = enemies[i];
                    if (enemy.health > 0) {
                        if (enemy.mesh && enemy.mesh.visible) {
                            boxes.push(enemy.mesh);
                        } else if (enemy.tempRagdoll && enemy.tempRagdoll.meshes) {
                            // Add all ragdoll meshes
                            for (const key in enemy.tempRagdoll.meshes) {
                                boxes.push(enemy.tempRagdoll.meshes[key]);
                            }
                        }
                    }
                }
                return boxes;
            }
            return []; 
        },
        setCullingEnabled() {}
    };

    // 4. TeamManager Stub
    const TeamManager = {
        getPlayerTeam(playerId) {
            return "SURVIVAL";
        },
        setPlayerTeam() {},
        getTeams() { return { "SURVIVAL": ["local"] }; },
        getLocalTeamId() { return 0; },
        setLocalTeam(id) {},
        verifyTeamAssignment(teamCount) {}
    };

    // 5. MatchState Stub
    const MatchState = {
        state: {
            status: "IN_GAME",
            mapId: "MAP",
            scores: { teamA: 0, teamB: 0 },
            timeRemaining: 9999,
            roundNumber: 1,
            gamemode: "SURVIVAL",
            activeWeather: "NONE",
            fogDensity: 0.015,
            isNight: true,
            nightMode: true
        },
        listeners: [],
        registerStateListener(cb) {
            if (cb) this.listeners.push(cb);
        },
        resetToDefaults() {},
        resetToLobby() {
            // Show main menu or return to menu
            if (window.TacticalShooter.GameManager) {
                window.TacticalShooter.GameManager.setMenuMode(true);
            }
        },
        syncMatchState() {},
        update(dt) {}
    };

    // 6. FirebaseManager Stub
    const FirebaseManager = {
        registerLobby() {},
        unsubscribe() {}
    };

    // 7. NetworkEventHandler Stub
    const NetworkEventHandler = {
        onChatReceived: null,
        broadcastChat() {},
        broadcastSpawnEntity() {},
        broadcastThrow() {},
        broadcastBulletHit() {},
        broadcastKillConfirm() {},
        broadcastDeath() {},
        broadcastEntityUsed() {}
    };

    // --- ANIMATION IMPLEMENTATIONS (AnimatorIK & AnimatorPoses) ---
    const AnimatorIK = {
        solveTwoBoneIK: function(bone1, bone2, pos1, pos3, hint, ik, len1, len2) {
            const THREE = window.THREE;
            if (!THREE) return;
            
            const p1 = pos1.clone();
            const p3 = pos3.clone();
            const d = p3.clone().sub(p1);
            const dist = d.length();
            
            const maxLen = len1 + len2 - 0.001;
            const minLen = Math.abs(len1 - len2) + 0.001;
            let finalDist = dist;
            
            if (dist > maxLen) {
                d.setLength(maxLen);
                p3.copy(p1).add(d);
                finalDist = maxLen;
            } else if (dist < minLen) {
                d.setLength(minLen);
                p3.copy(p1).add(d);
                finalDist = minLen;
            }
            
            const cosB = (len1 * len1 + len2 * len2 - finalDist * finalDist) / (2 * len1 * len2);
            const angleB = Math.acos(Math.max(-1, Math.min(1, cosB)));
            
            const cosA = (len1 * len1 + finalDist * finalDist - len2 * len2) / (2 * len1 * finalDist);
            const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)));
            
            const dir = d.clone().normalize();
            const hintDir = hint.clone().sub(p1).normalize();
            const planeNormal = new THREE.Vector3().crossVectors(dir, hintDir).normalize();
            const orthoHintDir = new THREE.Vector3().crossVectors(planeNormal, dir).normalize();
            
            const elbowDirection = dir.clone().multiplyScalar(Math.cos(angleA))
                .add(orthoHintDir.clone().multiplyScalar(Math.sin(angleA)))
                .normalize();
            
            const p2 = p1.clone().add(elbowDirection.clone().multiplyScalar(len1));
            const parent = bone1.parent;
            const parentWorldQuat = new THREE.Quaternion();
            if (parent) {
                parent.getWorldQuaternion(parentWorldQuat);
            }
            
            const defaultAxis = (ik && ik.boneAxis) ? ik.boneAxis : new THREE.Vector3(0, -1, 0);
            const q1World = new THREE.Quaternion().setFromUnitVectors(defaultAxis, elbowDirection);
            const q1Local = q1World.clone().premultiply(parentWorldQuat.clone().invert());
            bone1.quaternion.copy(q1Local);
            bone1.updateMatrixWorld(true);
            
            const bone1WorldQuat = new THREE.Quaternion();
            bone1.getWorldQuaternion(bone1WorldQuat);
            
            const forearmDirection = p3.clone().sub(p2).normalize();
            const q2World = new THREE.Quaternion().setFromUnitVectors(defaultAxis, forearmDirection);
            const q2Local = q2World.clone().premultiply(bone1WorldQuat.clone().invert());
            bone2.quaternion.copy(q2Local);
            bone2.updateMatrixWorld(true);
        }
    };

    const AnimatorPoses = {
        updateProceduralMovement: function(dt, state, stats, animator, mesh) {
            const THREE = window.THREE;
            if (!THREE) return;
            
            const T = animator.targets;
            T.bodyPos.set(0, 0, 0);
            T.torsoRot.set(0, 0, 0);
            T.leftLeg.rot.set(0, 0, 0);
            T.rightLeg.rot.set(0, 0, 0);
            T.leftKnee.rotX = 0;
            T.rightKnee.rotX = 0;
            
            if (!T.leftFoot) T.leftFoot = { rotX: 0 };
            else T.leftFoot.rotX = 0;
            if (!T.rightFoot) T.rightFoot = { rotX: 0 };
            else T.rightFoot.rotX = 0;
            
            const isCrouching = stats.isCrouching || state.isCrouching;
            const isSliding = stats.isSliding || state.isSliding;
            const isProne = stats.isProne || state.isProne;
            const isMoving = stats.isMoving;
            const isSprinting = stats.isSprinting;
            
            if (isProne) {
                T.bodyPos.y = -0.75;
                T.torsoRot.x = 0.4;
                T.leftLeg.rot.x = -0.5;
                T.rightLeg.rot.x = -0.5;
            } else if (isSliding) {
                T.bodyPos.y = -0.45;
                T.torsoRot.x = -0.3;
                T.leftLeg.rot.x = -1.0;
                T.leftKnee.rotX = 1.2;
                T.rightLeg.rot.x = 0.5;
                T.rightKnee.rotX = 0.4;
            } else if (isCrouching) {
                T.bodyPos.y = -0.3;
                T.torsoRot.x = 0.1;
                T.leftLeg.rot.x = -0.3;
                T.rightLeg.rot.x = -0.3;
                T.leftKnee.rotX = 0.6;
                T.rightKnee.rotX = 0.6;
            }
            
            if (state.lean) {
                T.torsoRot.z = -state.lean * 0.15;
                T.bodyPos.x = -state.lean * 0.12;
            }
            
            if (isMoving && !isSliding && !isProne) {
                const swingPeriod = isSprinting ? 0.9 : 0.6;
                const kneePeriod = swingPeriod * 1.5;
                const time = animator.animTime || 0;
                
                T.leftLeg.rot.x = Math.sin(time) * swingPeriod;
                T.rightLeg.rot.x = -Math.sin(time) * swingPeriod;
                
                T.leftKnee.rotX = Math.max(0, Math.sin(time + Math.PI/2)) * kneePeriod;
                T.rightKnee.rotX = Math.max(0, Math.sin(-time + Math.PI/2)) * kneePeriod;
                
                T.bodyPos.y += Math.abs(Math.sin(time * 2)) * -0.05;
            }
        },
        
        applyBaseTransforms: function(dt, isMoving, isSliding, animator) {
            const THREE = window.THREE;
            if (!THREE) return;
            
            const P = animator.parts;
            const T = animator.targets;
            
            if (P.bodyGroup) {
                P.bodyGroup.position.lerp(T.bodyPos, dt * 15.0);
            }
            
            if (P.torso) {
                P.torso.rotation.x = THREE.MathUtils.lerp(P.torso.rotation.x, T.torsoRot.x, dt * 15.0);
                P.torso.rotation.y = THREE.MathUtils.lerp(P.torso.rotation.y, T.torsoRot.y, dt * 15.0);
                P.torso.rotation.z = THREE.MathUtils.lerp(P.torso.rotation.z, T.torsoRot.z, dt * 15.0);
            }
            
            if (P.head) {
                P.head.rotation.x = THREE.MathUtils.lerp(P.head.rotation.x, T.headRot.x, dt * 15.0);
                P.head.rotation.y = THREE.MathUtils.lerp(P.head.rotation.y, T.headRot.y, dt * 15.0);
                P.head.rotation.z = THREE.MathUtils.lerp(P.head.rotation.z, T.headRot.z, dt * 15.0);
            }
            
            if (P.leftLeg) {
                P.leftLeg.rotation.x = THREE.MathUtils.lerp(P.leftLeg.rotation.x, T.leftLeg.rot.x, dt * 15.0);
                if (P.leftLeg.userData && P.leftLeg.userData.knee) {
                    const knee = P.leftLeg.userData.knee;
                    knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, -T.leftKnee.rotX, dt * 15.0);
                    if (knee.userData && knee.userData.foot) {
                        knee.userData.foot.rotation.x = THREE.MathUtils.lerp(knee.userData.foot.rotation.x, T.leftFoot.rotX, dt * 15.0);
                    }
                }
            }
            
            if (P.rightLeg) {
                P.rightLeg.rotation.x = THREE.MathUtils.lerp(P.rightLeg.rotation.x, T.rightLeg.rot.x, dt * 15.0);
                if (P.rightLeg.userData && P.rightLeg.userData.knee) {
                    const knee = P.rightLeg.userData.knee;
                    knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, -T.rightKnee.rotX, dt * 15.0);
                    if (knee.userData && knee.userData.foot) {
                        knee.userData.foot.rotation.x = THREE.MathUtils.lerp(knee.userData.foot.rotation.x, T.rightFoot.rotX, dt * 15.0);
                    }
                }
            }
        }
    };

    // 8. MultiplayerUI Stub for Singleplayer / offline use
    const MultiplayerUI = {
        setHUDVisible(visible) {
            const hud = document.getElementById('hud');
            if (hud) {
                hud.style.display = visible ? 'block' : 'none';
            }
        },
        showMainMenu() {
            if (window.TacticalShooter.UIManager) {
                window.TacticalShooter.UIManager.isMenuOpen = true;
                const menu = document.getElementById('esc-menu');
                if (menu) {
                    menu.style.display = 'block';
                    menu.classList.add('active');
                }
            }
        },
        requestPointerLock() {
            const canvas = document.getElementById('game-canvas');
            if (canvas && canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        }
    };

    // Export to global namespace
    window.TacticalShooter.PlayroomManager = PlayroomManager;
    window.TacticalShooter.RemotePlayerManager = RemotePlayerManager;
    window.TacticalShooter.TeamManager = TeamManager;
    window.TacticalShooter.MatchState = MatchState;
    window.TacticalShooter.FirebaseManager = FirebaseManager;
    window.TacticalShooter.NetworkEventHandler = NetworkEventHandler;
    window.TacticalShooter.AnimatorIK = AnimatorIK;
    window.TacticalShooter.AnimatorPoses = AnimatorPoses;
    window.TacticalShooter.MultiplayerUI = MultiplayerUI;

    // --- STUBS FOR PERKS AND SCORESTREAKS ---
})();
