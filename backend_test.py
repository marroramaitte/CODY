#!/usr/bin/env python3
"""
Backend API Testing for Conversational Agents System
Tests all agent management and chat functionality endpoints
"""

import requests
import json
import time
import sys
from datetime import datetime

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=')[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_BASE = f"{BACKEND_URL}/api"
print(f"🔗 Testing backend at: {API_BASE}")

class AgentSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.created_sessions = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        
    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                data = response.json()
                if "Live Development System" in data.get('message', ''):
                    self.log_test("API Health Check", True, f"Status: {response.status_code}, Message: {data['message']}")
                    return True
                else:
                    self.log_test("API Health Check", False, f"Unexpected message: {data}")
                    return False
            else:
                self.log_test("API Health Check", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False
            
    def test_get_agents(self):
        """Test GET /api/agents endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/agents")
            if response.status_code == 200:
                agents = response.json()
                if isinstance(agents, list) and len(agents) == 5:
                    # Verify expected agent types
                    expected_agents = ['code_assistant', 'debugging_expert', 'code_reviewer', 'doc_generator', 'optimization_expert']
                    agent_ids = [agent['id'] for agent in agents]
                    
                    if all(agent_id in agent_ids for agent_id in expected_agents):
                        # Verify agent structure
                        first_agent = agents[0]
                        required_fields = ['id', 'name', 'description', 'system_message', 'icon', 'personality', 'provider', 'model']
                        if all(field in first_agent for field in required_fields):
                            self.log_test("GET /api/agents", True, f"Found {len(agents)} agents with correct structure")
                            return agents
                        else:
                            missing_fields = [field for field in required_fields if field not in first_agent]
                            self.log_test("GET /api/agents", False, f"Missing fields: {missing_fields}")
                            return None
                    else:
                        missing_agents = [agent_id for agent_id in expected_agents if agent_id not in agent_ids]
                        self.log_test("GET /api/agents", False, f"Missing expected agents: {missing_agents}")
                        return None
                else:
                    self.log_test("GET /api/agents", False, f"Expected 5 agents, got {len(agents) if isinstance(agents, list) else 'non-list'}")
                    return None
            else:
                self.log_test("GET /api/agents", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("GET /api/agents", False, f"Error: {str(e)}")
            return None
            
    def test_get_specific_agent(self, agent_id):
        """Test GET /api/agents/{agent_id} endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/agents/{agent_id}")
            if response.status_code == 200:
                agent = response.json()
                if agent['id'] == agent_id:
                    self.log_test(f"GET /api/agents/{agent_id}", True, f"Agent: {agent['name']}")
                    return agent
                else:
                    self.log_test(f"GET /api/agents/{agent_id}", False, f"ID mismatch: expected {agent_id}, got {agent['id']}")
                    return None
            else:
                self.log_test(f"GET /api/agents/{agent_id}", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_test(f"GET /api/agents/{agent_id}", False, f"Error: {str(e)}")
            return None
            
    def test_send_chat_message(self, agent_id, message, session_id=None):
        """Test POST /api/chat/send endpoint"""
        try:
            payload = {
                "agent_id": agent_id,
                "message": message
            }
            if session_id:
                payload["session_id"] = session_id
                
            response = self.session.post(f"{API_BASE}/chat/send", json=payload)
            if response.status_code == 200:
                chat_response = response.json()
                required_fields = ['session_id', 'message', 'agent_id', 'timestamp']
                if all(field in chat_response for field in required_fields):
                    if chat_response['agent_id'] == agent_id:
                        # Store session for cleanup
                        if chat_response['session_id'] not in self.created_sessions:
                            self.created_sessions.append(chat_response['session_id'])
                        
                        self.log_test(f"POST /api/chat/send ({agent_id})", True, 
                                    f"Session: {chat_response['session_id'][:8]}..., Response length: {len(chat_response['message'])}")
                        return chat_response
                    else:
                        self.log_test(f"POST /api/chat/send ({agent_id})", False, 
                                    f"Agent ID mismatch: expected {agent_id}, got {chat_response['agent_id']}")
                        return None
                else:
                    missing_fields = [field for field in required_fields if field not in chat_response]
                    self.log_test(f"POST /api/chat/send ({agent_id})", False, f"Missing fields: {missing_fields}")
                    return None
            else:
                self.log_test(f"POST /api/chat/send ({agent_id})", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test(f"POST /api/chat/send ({agent_id})", False, f"Error: {str(e)}")
            return None
            
    def test_get_user_sessions(self):
        """Test GET /api/chat/sessions endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/chat/sessions")
            if response.status_code == 200:
                sessions = response.json()
                if isinstance(sessions, list):
                    self.log_test("GET /api/chat/sessions", True, f"Found {len(sessions)} sessions")
                    return sessions
                else:
                    self.log_test("GET /api/chat/sessions", False, "Response is not a list")
                    return None
            else:
                self.log_test("GET /api/chat/sessions", False, f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_test("GET /api/chat/sessions", False, f"Error: {str(e)}")
            return None
            
    def test_get_session_messages(self, session_id):
        """Test GET /api/chat/sessions/{session_id}/messages endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/chat/sessions/{session_id}/messages")
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list):
                    self.log_test(f"GET /api/chat/sessions/{session_id[:8]}.../messages", True, 
                                f"Found {len(messages)} messages")
                    return messages
                else:
                    self.log_test(f"GET /api/chat/sessions/{session_id[:8]}.../messages", False, 
                                "Response is not a list")
                    return None
            else:
                self.log_test(f"GET /api/chat/sessions/{session_id[:8]}.../messages", False, 
                            f"Status: {response.status_code}")
                return None
        except Exception as e:
            self.log_test(f"GET /api/chat/sessions/{session_id[:8]}.../messages", False, f"Error: {str(e)}")
            return None
            
    def test_create_chat_session(self, agent_id):
        """Test POST /api/chat/sessions endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/chat/sessions", params={"agent_id": agent_id})
            if response.status_code == 200:
                session = response.json()
                if session['agent_id'] == agent_id:
                    # Store session for cleanup
                    if session['id'] not in self.created_sessions:
                        self.created_sessions.append(session['id'])
                    
                    self.log_test(f"POST /api/chat/sessions ({agent_id})", True, 
                                f"Created session: {session['id'][:8]}...")
                    return session
                else:
                    self.log_test(f"POST /api/chat/sessions ({agent_id})", False, 
                                f"Agent ID mismatch: expected {agent_id}, got {session['agent_id']}")
                    return None
            else:
                self.log_test(f"POST /api/chat/sessions ({agent_id})", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test(f"POST /api/chat/sessions ({agent_id})", False, f"Error: {str(e)}")
            return None
            
    def test_delete_session(self, session_id):
        """Test DELETE /api/chat/sessions/{session_id} endpoint"""
        try:
            response = self.session.delete(f"{API_BASE}/chat/sessions/{session_id}")
            if response.status_code == 200:
                self.log_test(f"DELETE /api/chat/sessions/{session_id[:8]}...", True, "Session deleted")
                return True
            else:
                self.log_test(f"DELETE /api/chat/sessions/{session_id[:8]}...", False, 
                            f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test(f"DELETE /api/chat/sessions/{session_id[:8]}...", False, f"Error: {str(e)}")
            return False
            
    def test_agent_personalities(self, agents):
        """Test that different agents respond with different personalities"""
        test_message = "Explain what you do and how you can help me with software development."
        
        responses = {}
        for agent in agents[:3]:  # Test first 3 agents to save time
            agent_id = agent['id']
            response = self.test_send_chat_message(agent_id, test_message)
            if response:
                responses[agent_id] = response['message']
                time.sleep(1)  # Brief pause between requests
                
        # Check if responses are different (indicating different personalities)
        if len(responses) >= 2:
            response_texts = list(responses.values())
            all_different = all(resp1 != resp2 for i, resp1 in enumerate(response_texts) 
                              for resp2 in response_texts[i+1:])
            
            if all_different:
                self.log_test("Agent Personality Differentiation", True, 
                            f"All {len(responses)} agents provided unique responses")
            else:
                self.log_test("Agent Personality Differentiation", False, 
                            "Some agents provided identical responses")
        else:
            self.log_test("Agent Personality Differentiation", False, 
                        f"Could only test {len(responses)} agents")
            
    def cleanup_sessions(self):
        """Clean up created test sessions"""
        print(f"\n🧹 Cleaning up {len(self.created_sessions)} test sessions...")
        for session_id in self.created_sessions:
            self.test_delete_session(session_id)
            
    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting Conversational Agents System Backend Tests")
        print("=" * 60)
        
        # Test 1: API Health
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
            
        # Test 2: Get all agents
        agents = self.test_get_agents()
        if not agents:
            print("❌ Cannot retrieve agents. Stopping tests.")
            return False
            
        # Test 3: Get specific agents
        for agent in agents[:2]:  # Test first 2 agents
            self.test_get_specific_agent(agent['id'])
            
        # Test 4: Test chat functionality with different agents
        print(f"\n💬 Testing chat functionality with different agents...")
        test_messages = [
            "Hello! Can you help me optimize this Python function?",
            "I'm having trouble with a bug in my React component. Can you help debug it?",
            "Please review this code for best practices and security issues."
        ]
        
        chat_responses = []
        for i, agent in enumerate(agents[:3]):  # Test first 3 agents
            message = test_messages[i] if i < len(test_messages) else "Hello, how can you help me?"
            response = self.test_send_chat_message(agent['id'], message)
            if response:
                chat_responses.append(response)
                time.sleep(1)  # Brief pause between requests
                
        # Test 5: Session management
        print(f"\n📋 Testing session management...")
        sessions = self.test_get_user_sessions()
        
        # Test 6: Get messages from sessions
        if chat_responses:
            for response in chat_responses[:2]:  # Test first 2 sessions
                self.test_get_session_messages(response['session_id'])
                
        # Test 7: Create new session explicitly
        if agents:
            self.test_create_chat_session(agents[0]['id'])
            
        # Test 8: Test agent personalities
        print(f"\n🎭 Testing agent personality differentiation...")
        self.test_agent_personalities(agents)
        
        # Test 9: Session persistence (send another message to existing session)
        if chat_responses:
            print(f"\n🔄 Testing session persistence...")
            first_session = chat_responses[0]
            follow_up_response = self.test_send_chat_message(
                first_session['agent_id'], 
                "Thank you for that explanation. Can you provide a specific example?",
                first_session['session_id']
            )
            if follow_up_response:
                # Verify it's the same session
                if follow_up_response['session_id'] == first_session['session_id']:
                    self.log_test("Session Persistence", True, "Follow-up message used same session")
                else:
                    self.log_test("Session Persistence", False, "Follow-up message created new session")
        
        # Cleanup
        self.cleanup_sessions()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
                    
        return failed_tests == 0

def main():
    tester = AgentSystemTester()
    success = tester.run_comprehensive_test()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'success': success,
            'results': tester.test_results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    if success:
        print("🎉 All tests passed! The conversational agents system is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the results above for details.")
        return 1

if __name__ == "__main__":
    exit(main())